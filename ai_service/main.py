import io
import os
import re
import json
from typing import Optional, List
import fitz
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

try:
    from groq import Groq
except Exception:
    Groq = None

app = FastAPI(title='ExceptionIQ AI Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv('GROQ_API_KEY')) if Groq and os.getenv('GROQ_API_KEY') else None

class TextPayload(BaseModel):
    markdown: str
    task: Optional[str] = 'summarize'

class ClassifyPayload(BaseModel):
    ledger_amount: float
    bank_amount: float
    ledger_date: str
    bank_date: str
    ledger_party: str = ''
    bank_party: str = ''

class ParsedRow(BaseModel):
    txn_date: str
    amount: float
    debit_credit: str   # "debit" or "credit"
    reference: str
    narration: str
    counterparty: str
    needs_review: bool

DATE_PATTERN = re.compile(
    r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2}-[A-Za-z]{3}-\d{4})\b'
)
AMOUNT_PATTERN = re.compile(r'[\d,]+\.\d{2}(?:\s*(?:Dr|Cr|dr|cr))?')

def _parse_amount(raw: str) -> tuple[float, str]:
    raw = raw.replace(',', '').strip()
    if raw.lower().endswith('dr'):
        try:
            return float(re.sub(r'[^\d.]', '', raw)), 'debit'
        except ValueError:
            return 0.0, 'unknown'
    if raw.lower().endswith('cr'):
        try:
            return float(re.sub(r'[^\d.]', '', raw)), 'credit'
        except ValueError:
            return 0.0, 'unknown'
    try:
        return float(re.sub(r'[^\d.]', '', raw)), 'credit'
    except ValueError:
        return 0.0, 'unknown'

def _extract_rows(text: str) -> List[ParsedRow]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 10:
            continue
        date_match = DATE_PATTERN.search(line)
        amount_matches = AMOUNT_PATTERN.findall(line)
        if not date_match or not amount_matches:
            continue
        # Use amount_matches[-2] if multiple amounts exist (e.g. txn amount and balance), otherwise amount_matches[0]
        raw_amount = amount_matches[-2] if len(amount_matches) >= 2 else amount_matches[0]
        amount, dc = _parse_amount(raw_amount)
        
        narration = line[date_match.end():].strip()
        for amt in amount_matches:
            narration = narration.replace(amt, '').strip()
            
        rows.append(ParsedRow(
            txn_date=date_match.group(0),
            amount=amount,
            debit_credit=dc,
            reference='',
            narration=narration[:200],
            counterparty='',
            needs_review=(amount == 0.0 or dc == 'unknown'),
        ))
    return rows

def clean_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return '\n'.join(lines)

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.post('/parse-document')
async def parse_document(file: UploadFile = File(...)):
    content = await file.read()
    try:
        doc = fitz.open(stream=content, filetype='pdf')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")
    chunks = []
    for page in doc:
        chunks.append(page.get_text('text'))
    text = clean_text('\n'.join(chunks))
    markdown = '\n\n'.join(f'- {line}' for line in text.splitlines())
    return {'markdown': markdown[:25000]}

@app.post('/parse-bank-pdf')
async def parse_bank_pdf(file: UploadFile = File(...)):
    content = await file.read()
    try:
        doc = fitz.open(stream=content, filetype='pdf')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")
    full_text = '\n'.join(page.get_text('text') for page in doc)
    rows = _extract_rows(full_text)
    return {
        'rows': [r.model_dump() for r in rows],
        'total': len(rows),
        'unparsed_count': sum(1 for r in rows if r.needs_review),
    }

@app.post('/summarize-exception')
def summarize_exception(payload: TextPayload):
    markdown = payload.markdown[:12000]
    if not client:
        # Smart rule-based summary fallback
        code_match = re.search(r'Exception Code(?:\*\*)?:\s*(\S+)', markdown, re.IGNORECASE)
        amount_match = re.search(r'Amount Difference(?:\*\*)?:\s*([-\d\.,]+)', markdown, re.IGNORECASE)
        date_match = re.search(r'Date Difference(?:\*\*)?:\s*(\d+)', markdown, re.IGNORECASE)
        
        code = code_match.group(1) if code_match else 'UNKNOWN'
        amount = amount_match.group(1) if amount_match else '0.00'
        date_diff = date_match.group(1) if date_match else '0'
        
        summary = "### 🔍 Exception IQ Insight\n\n"
        if code == 'BANK-AMT':
            summary += f"- **Issue**: Amount mismatch detected between ledger and bank statement.\n"
            summary += f"- **Variance**: A difference of **₹{amount}** requires adjustment.\n"
            summary += f"- **Likely Cause**: Bank charges, exchange rate differences, or transcription errors.\n"
            summary += f"- **Recommendation**: Review bank statement narration for hidden charges and create a write-off or adjustment entry.\n"
        elif code == 'BANK-MISS-LEDGER':
            summary += f"- **Issue**: A bank transaction has no matching entry in the general ledger.\n"
            summary += f"- **Amount**: **₹{amount}** was transacted at the bank.\n"
            summary += f"- **Likely Cause**: Unrecorded direct transfers, auto-debits, or interest credits.\n"
            summary += f"- **Recommendation**: Verify bank statement narration and create the corresponding ledger entry to balance the books.\n"
        elif code == 'BANK-MISS-BANK':
            summary += f"- **Issue**: A ledger transaction has no matching entry in the bank statement.\n"
            summary += f"- **Amount**: **₹{amount}** is recorded in the ledger.\n"
            summary += f"- **Likely Cause**: Uncleared checks, deposits in transit, or incorrect booking.\n"
            summary += f"- **Recommendation**: Wait for clearing or check with the bank/counterparty if the transaction failed.\n"
        elif code == 'BANK-DATE':
            summary += f"- **Issue**: Transaction date drift detected.\n"
            summary += f"- **Drift**: Date mismatch of **{date_diff} days** between records.\n"
            summary += f"- **Likely Cause**: Value date vs. book date differences or late clearance.\n"
            summary += f"- **Recommendation**: Verify clearing timeline and accept if within standard bank processing window.\n"
        elif code == 'BANK-REF':
            summary += f"- **Issue**: Reference code discrepancy.\n"
            summary += f"- **Likely Cause**: Typo in ledger reference or bank reference abbreviation.\n"
            summary += f"- **Recommendation**: Compare counterparty names and narration. Manual override match if verified.\n"
        elif code == 'BANK-DUP':
            summary += f"- **Issue**: Suspected duplicate transaction.\n"
            summary += f"- **Likely Cause**: Vendor double billing or duplicate payment transaction execution.\n"
            summary += f"- **Recommendation**: Confirm check/transfer logs with accounting. Void one of the entries or request refund/credit note.\n"
        else:
            summary += f"- **Issue**: General mismatch found during bank reconciliation.\n"
            summary += f"- **Amount Variance**: ₹{amount}\n"
            summary += f"- **Recommendation**: Review source documents to verify counterparty details and transaction records.\n"
            
        summary += "\n- **Status**: Awaiting resolution by assigned analyst."
        return {'summary': summary}
        
    prompt = f"""Summarize this reconciliation exception context in 5 bullet points:
 
{markdown}"""
    response = client.chat.completions.create(
        model='llama-3.1-8b-instant',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.1,
        max_tokens=180,
    )
    return {'summary': response.choices[0].message.content}

@app.post('/classify-exception')
def classify_exception(payload: ClassifyPayload):
    amount_diff = abs(payload.ledger_amount - payload.bank_amount)
    if amount_diff > 0:
        return {'code': 'BANK-AMT'}
    if payload.ledger_date != payload.bank_date:
        return {'code': 'BANK-DATE'}
    if payload.ledger_party.lower().strip() != payload.bank_party.lower().strip():
        return {'code': 'BANK-NAME'}
    return {'code': 'BANK-REF'}

@app.post('/parse-gstr2b')
async def parse_gstr2b(file: UploadFile = File(...)):
    """
    Accepts GSTR-2B JSON file (downloaded from GST portal).
    Returns a flat list of invoice rows ready for DB insert.
    """
    try:
        content = await file.read()
        data = json.loads(content)
        b2b_suppliers = data.get('data', {}).get('docdata', {}).get('b2b', [])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GSTR-2B JSON: {str(e)}")

    rows = []
    for supplier in b2b_suppliers:
        ctin = supplier.get('ctin', '')
        for inv in supplier.get('inv', []):
            itms = inv.get('itms', [{}])
            itm  = itms[0].get('itm_det', {}) if itms else {}
            rows.append({
                'supplier_gstin': ctin,
                'invoice_number': inv.get('inum', ''),
                'invoice_date':   inv.get('idt', ''),
                'taxable_value':  itm.get('txval', 0),
                'igst':           itm.get('igst', 0),
                'cgst':           itm.get('cgst', 0),
                'sgst':           itm.get('sgst', 0),
                'total_tax':      round(itm.get('igst', 0) + itm.get('cgst', 0) + itm.get('sgst', 0), 2),
            })
    return {'rows': rows, 'total': len(rows)}

@app.post('/parse-26as')
async def parse_26as(file: UploadFile = File(...)):
    """
    Accepts Form 26AS as plain text (copy-pasted from IT portal) or CSV.
    Returns structured rows: deductor PAN, section, gross amount, TDS amount.
    """
    content = (await file.read()).decode('utf-8', errors='replace')
    rows = []
    PAN_RE      = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')
    AMOUNT_RE   = re.compile(r'[\d,]+\.\d{2}')
    SECTION_RE  = re.compile(r'\b(19[0-9][A-Z]?|195)\b')

    for line in content.splitlines():
        line = line.strip()
        if not line or len(line) < 20:
            continue
        pan_match     = PAN_RE.search(line)
        amounts       = AMOUNT_RE.findall(line)
        section_match = SECTION_RE.search(line)
        if not pan_match or len(amounts) < 2:
            continue
        rows.append({
            'deductor_pan':  pan_match.group(0),
            'gross_amount':  float(amounts[0].replace(',', '')),
            'tds_amount':    float(amounts[1].replace(',', '')),
            'section_code':  section_match.group(0) if section_match else '',
            'needs_review':  not section_match,
        })
    return {'rows': rows, 'total': len(rows)}

