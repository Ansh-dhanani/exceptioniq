import csv
import io
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model, authenticate, login, logout
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.entities.models import Entity
from apps.reconciliation.models import Batch, LedgerEntry, BankStatementLine
from apps.exceptions_app.models import ExceptionRecord, ExceptionComment, AuditLog
from apps.routing.models import RoutingRule

from .serializers import (
    EntitySerializer, BatchSerializer, LedgerEntrySerializer,
    BankStatementLineSerializer, ExceptionRecordSerializer,
    ExceptionCommentSerializer, RoutingRuleSerializer, UserSerializer
)
from .services import detect_bank_exceptions, apply_routing
from .permissions import RolePermission

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'organization': str(user.organization.id) if user.organization else None,
            'organization_name': user.organization.name if user.organization else None,
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout(request):
    logout(request)
    return Response({'status': 'logged_out'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        'id': str(request.user.id),
        'username': request.user.username,
        'email': request.user.email,
        'role': request.user.role,
        'first_name': request.user.first_name,
        'last_name': request.user.last_name,
        'organization': str(request.user.organization.id) if request.user.organization else None,
        'organization_name': request.user.organization.name if request.user.organization else None,
    })

class EntityViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = Entity.objects.all().order_by('name')
    serializer_class = EntitySerializer

class RoutingRuleViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = RoutingRule.objects.select_related('entity').all().order_by('-created_at')
    serializer_class = RoutingRuleSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [RolePermission]
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer

class ExceptionViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    queryset = ExceptionRecord.objects.select_related('entity', 'assigned_to').prefetch_related('comments', 'audit_logs').all().order_by('-created_at')
    serializer_class = ExceptionRecordSerializer
    filterset_fields = ['entity', 'reconciliation_type', 'exception_code', 'status', 'severity']

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        exception = self.get_object()
        serializer = ExceptionCommentSerializer(data={
            'exception': str(exception.id),
            'message': request.data.get('message', '').strip(),
        })
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user)
        AuditLog.objects.create(exception=exception, user=request.user, action='commented', metadata={'comment_id': str(comment.id)})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'resolved'
        exception.resolution_code = request.data.get('resolution_code', 'manual_resolution')
        exception.resolved_at = timezone.now()
        exception.save(update_fields=['status', 'resolution_code', 'resolved_at', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Resolved: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='resolved', metadata={'resolution_code': exception.resolution_code, 'note': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'closed'
        exception.save(update_fields=['status', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Approved: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='approved', metadata={'note': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        exception = self.get_object()
        exception.status = 'investigating'
        exception.save(update_fields=['status', 'updated_at'])
        
        note = request.data.get('note', '').strip()
        if note:
            ExceptionComment.objects.create(exception=exception, user=request.user, message=f"Rejected: {note}")
            
        AuditLog.objects.create(exception=exception, user=request.user, action='rejected', metadata={'reason': note})
        return Response(ExceptionRecordSerializer(exception).data)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        exception = self.get_object()
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
            exception.assigned_to = user
            exception.save(update_fields=['assigned_to', 'updated_at'])
            AuditLog.objects.create(exception=exception, user=request.user, action='reassigned', metadata={'assigned_to': user.username})
            return Response(ExceptionRecordSerializer(exception).data)
        except (ValueError, TypeError, User.DoesNotExist):
            return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='ai-summary')
    def ai_summary(self, request, pk=None):
        exception = self.get_object()
        import requests
        from django.conf import settings
        
        desc = f"""# Reconciliation Exception Details
- **Exception ID**: {exception.id}
- **Type**: {exception.reconciliation_type.upper()}
- **Exception Code**: {exception.exception_code}
- **Severity**: {exception.severity.upper()}
- **Status**: {exception.status.upper()}
- **Amount Difference**: {exception.amount_difference}
- **Date Difference**: {exception.date_difference} days
- **Context**: {exception.context}
"""
        try:
            res = requests.post(
                f"{settings.AI_SERVICE_URL}/summarize-exception",
                json={'markdown': desc},
                timeout=5
            )
            if res.status_code == 200:
                return Response(res.json())
            return Response({'summary': f"AI service returned status code {res.status_code}"})
        except Exception as e:
            return Response({'summary': f"Error calling AI Service: {str(e)}"})

    @action(detail=False, methods=['get'], url_path='export-pdf-report')
    def export_pdf_report(self, request):
        import io
        from django.http import HttpResponse
        from django.utils import timezone
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        exceptions = ExceptionRecord.objects.all().order_by('created_at')
        total_count = exceptions.count()
        
        status_counts = {
            'detected': exceptions.filter(status='detected').count(),
            'routed': exceptions.filter(status='routed').count(),
            'investigating': exceptions.filter(status='investigating').count(),
            'pending_approval': exceptions.filter(status='pending_approval').count(),
            'resolved': exceptions.filter(status='resolved').count(),
            'approved': exceptions.filter(status='approved').count(),
            'closed': exceptions.filter(status='closed').count(),
        }
        
        open_count = status_counts['detected'] + status_counts['routed'] + status_counts['investigating'] + status_counts['pending_approval']
        closed_count = status_counts['resolved'] + status_counts['approved'] + status_counts['closed']
        
        now = timezone.now()
        urgent_count = exceptions.filter(status__in=['detected', 'routed', 'investigating'], sla_deadline__lt=now).count()
        
        total_aging_days = 0
        aging_counts = {
            '0-2 Days': 0,
            '3-5 Days': 0,
            '6-10 Days': 0,
            '10+ Days': 0,
        }
        
        resolved_exceptions = []
        open_exceptions = []
        
        for exc in exceptions:
            age_td = now - exc.created_at
            age_days = max(0, age_td.days)
            if age_days <= 2:
                aging_counts['0-2 Days'] += 1
            elif age_days <= 5:
                aging_counts['3-5 Days'] += 1
            elif age_days <= 10:
                aging_counts['6-10 Days'] += 1
            else:
                aging_counts['10+ Days'] += 1
                
            if exc.resolved_at:
                resolved_exceptions.append(max(0, (exc.resolved_at - exc.created_at).days))
            else:
                open_exceptions.append(age_days)
                
        avg_res_days = (sum(resolved_exceptions) / len(resolved_exceptions)) if resolved_exceptions else 0.0
        avg_open_days = (sum(open_exceptions) / len(open_exceptions)) if open_exceptions else 0.0
        
        type_counts = {}
        for exc in exceptions:
            t = exc.reconciliation_type.upper()
            type_counts[t] = type_counts.get(t, 0) + 1
            
        critical_exceptions = exceptions.filter(status__in=['detected', 'routed', 'investigating']).order_by('-severity', 'created_at')[:5]

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="exceptioniq_executive_report.pdf"'
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#1E3A8A'),
            spaceAfter=6
        )
        
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=20
        )
        
        h1_style = ParagraphStyle(
            'H1Style',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#1E3A8A'),
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=8
        )

        bold_body_style = ParagraphStyle(
            'BoldBodyStyle',
            parent=body_style,
            fontName='Helvetica-Bold'
        )
        
        meta_label_style = ParagraphStyle(
            'MetaLabel',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#475569')
        )
        
        meta_val_style = ParagraphStyle(
            'MetaVal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#0F172A')
        )
        
        th_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.white
        )
        
        td_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#0F172A')
        )

        bullet_style = ParagraphStyle(
            'BulletText',
            parent=body_style,
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=5
        )

        story = []
        
        story.append(Paragraph("EXCEPTIONIQ EXECUTIVE PERFORMANCE REPORT", title_style))
        story.append(Paragraph("Strategic Operations Summary, SLA Compliance & AI Gap Assessment", subtitle_style))
        
        meta_data = [
            [Paragraph("Report Scope:", meta_label_style), Paragraph("Global Reconciliation Exceptions & Turnaround Analysis", meta_val_style),
             Paragraph("Generated On:", meta_label_style), Paragraph(timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"), meta_val_style)],
            [Paragraph("Target Audience:", meta_label_style), Paragraph("Chief Financial Officer / Operations Management", meta_val_style),
             Paragraph("Generated By:", meta_label_style), Paragraph(f"{request.user.username} ({request.user.role.upper()})", meta_val_style)]
        ]
        meta_table = Table(meta_data, colWidths=[90, 160, 90, 160])
        meta_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))
        
        divider = Table([[""]], colWidths=[504])
        divider.setStyle(TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor('#0EA5E9')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(divider)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("1. Key Performance Indicators (KPIs)", h1_style))
        
        kpi_data = [
            [
                Paragraph("<b>TOTAL EXCEPTIONS</b><br/><font size=14 color='#1E3A8A'>%d</font>" % total_count, body_style),
                Paragraph("<b>OPEN INVESTIGATIONS</b><br/><font size=14 color='#E11D48'>%d</font>" % open_count, body_style),
                Paragraph("<b>SLA BREACHED / URGENT</b><br/><font size=14 color='#D97706'>%d</font>" % urgent_count, body_style),
                Paragraph("<b>AVG OPEN LIFE</b><br/><font size=14 color='#0284C7'>%.1f Days</font>" % avg_open_days, body_style)
            ]
        ]
        kpi_table = Table(kpi_data, colWidths=[126, 126, 126, 126])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("2. Exception Aging Distribution", h1_style))
        
        aging_rows = [
            [Paragraph("Aging Bracket", th_style), Paragraph("Record Count", th_style), Paragraph("Percentage", th_style)]
        ]
        for bracket, count in aging_counts.items():
            pct = (count / total_count * 100) if total_count > 0 else 0.0
            aging_rows.append([
                Paragraph(bracket, td_style),
                Paragraph(str(count), td_style),
                Paragraph("%.1f%%" % pct, td_style)
            ])
            
        aging_table = Table(aging_rows, colWidths=[168, 168, 168])
        aging_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(aging_table)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("3. Operational Gap & AI Strategic Assessment", h1_style))
        
        gaps = []
        resolutions = []
        
        if urgent_count > 0:
            gaps.append("<b>SLA Turnaround Lags:</b> There are currently <b>%d</b> exceptions that have surpassed their SLA deadlines. This indicates a high backlog in analyst investigation queues." % urgent_count)
            resolutions.append("Configure dynamic notifications and auto-escalation path triggers to alert managers when an open exception is within 8 hours of breaching.")
        else:
            gaps.append("<b>SLA Turnaround:</b> Current SLA compliance is nominal, with 0 outstanding breaches. Turnaround velocity is stable.")
            
        if avg_open_days > 5:
            gaps.append("<b>Cycle-Time Excess:</b> The average age of open exceptions is <b>%.1f days</b>. The industry standard target is 2.0 days. Long-tail unresolved items lead to audit exposure." % avg_open_days)
            resolutions.append("Adopt auto-reconciliation thresholds to auto-close exceptions below a nominal write-off amount (e.g. < $5.00), reducing manual load.")
        else:
            gaps.append("<b>Cycle-Time Efficiency:</b> Cycle times are currently healthy with an average age of <b>%.1f days</b>." % avg_open_days)
            
        missing_ledger_count = exceptions.filter(reconciliation_type__iexact='missing_ledger').count()
        if missing_ledger_count > 0:
            pct_missing = (missing_ledger_count / total_count * 100) if total_count > 0 else 0.0
            if pct_missing > 30:
                gaps.append("<b>Data Upload Asymmetry:</b> Missing Ledger entries constitute <b>%.1f%%</b> of all discrepancies. This indicates that bank statement updates are ingested faster than ERP ledger exports." % pct_missing)
                resolutions.append("Integrate direct daily batch synchronizations from the general ledger database (ERP system) to replace manual CSV uploads, aligning data sync cycles.")
                
        pending_appr_count = status_counts['pending_approval']
        if pending_appr_count > 2:
            gaps.append("<b>Maker-Checker Bottleneck:</b> There are <b>%d</b> exceptions awaiting manager/approver review in the <i>pending_approval</i> state." % pending_appr_count)
            resolutions.append("Establish dual-approval policies for high-value items only, letting low-value Maker resolutions auto-approve immediately upon submission.")
            
        if not resolutions:
            gaps.append("<b>Data Sync Alignment:</b> System operations are performing optimally. Exception volumes are distributed evenly.")
            resolutions.append("Enable machine learning routing rules to predict category owners based on historic reassignments, optimizing workflow efficiency.")

        story.append(Paragraph("<b>Operational Gaps Identified (Where & What is Lacking):</b>", bold_body_style))
        for g in gaps:
            story.append(Paragraph("• %s" % g, bullet_style))
            
        story.append(Spacer(1, 5))
        story.append(Paragraph("<b>Actionable Remediation Roadmap (How to Resolve):</b>", bold_body_style))
        for r in resolutions:
            story.append(Paragraph("• %s" % r, bullet_style))
            
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("4. High-Priority Action Items (Top 5 Oldest Open Exceptions)", h1_style))
        
        action_rows = [
            [
                Paragraph("ID", th_style), 
                Paragraph("Entity", th_style), 
                Paragraph("Type", th_style), 
                Paragraph("Diff Amount", th_style), 
                Paragraph("Age", th_style), 
                Paragraph("Owner", th_style)
            ]
        ]
        
        for exc in critical_exceptions:
            age_days = (now - exc.created_at).days
            owner_name = exc.assigned_to.username if exc.assigned_to else "Unassigned"
            action_rows.append([
                Paragraph(str(exc.id)[:8], td_style),
                Paragraph(exc.entity.name, td_style),
                Paragraph(exc.reconciliation_type.upper(), td_style),
                Paragraph(f"{exc.amount_difference:,.2f}", td_style),
                Paragraph(f"{age_days} Days", td_style),
                Paragraph(owner_name, td_style)
            ])
            
        if len(action_rows) == 1:
            action_rows.append([Paragraph("No critical open exceptions found.", td_style), "", "", "", "", ""])
            
        action_table = Table(action_rows, colWidths=[65, 95, 100, 85, 60, 99])
        action_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(action_table)

        def add_footer(canvas, doc_obj):
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.HexColor('#64748B'))
            canvas.drawString(54, 30, "ExceptionIQ Executive Report — Confidential")
            canvas.drawRightString(612 - 54, 30, f"Page {doc_obj.page}")
            canvas.restoreState()
            
        doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

class ReconciliationViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]

    @action(detail=False, methods=['post'], url_path='bank/upload')
    def bank_upload(self, request):
        entity_id = request.data.get('entity_id')
        csv_text = request.data.get('csv_text', '')
        rows_json = request.data.get('rows', None)
        source_type = request.data.get('source_type', 'bank')
        entity = Entity.objects.get(id=entity_id)
        batch = Batch.objects.create(entity=entity, recon_type='bank', status='processing', source_name=f'{source_type}_upload')

        reader = rows_json if rows_json is not None else list(csv.DictReader(io.StringIO(csv_text)))
        total = 0
        inserted = 0
        errors = []
        
        for idx, row in enumerate(reader):
            total += 1
            try:
                txn_date = row.get('txn_date')
                if not txn_date:
                    raise ValueError("Transaction date is missing.")
                
                amount_raw = row.get('amount')
                if amount_raw is None or amount_raw == '':
                    raise ValueError("Amount is missing.")
                
                try:
                    amount = Decimal(str(amount_raw))
                except Exception:
                    raise ValueError(f"Invalid amount format: '{amount_raw}'")

                payload = {
                    'entity': entity,
                    'batch': batch,
                    'txn_date': txn_date,
                    'amount': amount,
                    'reference': row.get('reference', '') or '',
                    'counterparty': row.get('counterparty', '') or '',
                    'raw_data': row,
                }
                
                with transaction.atomic():
                    if source_type == 'bank':
                        BankStatementLine.objects.create(narration=row.get('narration', '') or '', **payload)
                    else:
                        LedgerEntry.objects.create(account_type=row.get('account_type', 'bank') or 'bank', **payload)
                inserted += 1
            except Exception as e:
                errors.append({
                    'row_index': idx,
                    'error': str(e),
                    'row_data': row
                })

        batch.total_rows = total
        batch.status = 'completed'
        batch.save(update_fields=['total_rows', 'status', 'updated_at'])
        
        return Response({
            'batch': BatchSerializer(batch).data,
            'total_rows': total,
            'inserted_rows': inserted,
            'failed_rows': len(errors),
            'errors': errors
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bank/run')
    def bank_run(self, request):
        entity = Entity.objects.get(id=request.data.get('entity_id'))
        created = detect_bank_exceptions(entity)
        routed = [apply_routing(exc) for exc in created]
        return Response({'exceptions_created': len(routed)})

    @action(detail=False, methods=['post'], url_path='bank/clear')
    def bank_clear(self, request):
        from django.conf import settings
        if not settings.DEBUG:
            return Response(
                {"error": "This action is only available in debug mode."},
                status=status.HTTP_403_FORBIDDEN
            )
        entity_id = request.data.get('entity_id')
        if not entity_id:
            return Response({'error': 'entity_id is required'}, status=400)
        entity = Entity.objects.get(id=entity_id)
        with transaction.atomic():
            ExceptionRecord.objects.filter(entity=entity).delete()
            LedgerEntry.objects.filter(entity=entity).delete()
            BankStatementLine.objects.filter(entity=entity).delete()
            Batch.objects.filter(entity=entity).delete()
        return Response({'status': 'cleared'})

@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})
