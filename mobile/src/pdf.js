import Constants from 'expo-constants';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { STATUS_LABELS, TYPE_LABELS } from './store/invoicesStore';

const extra = Constants.expoConfig?.extra || {};

export const business = {
  name: extra.businessName || '',
  line1: extra.businessLine1 || '',
  line2: extra.businessLine2 || '',
  footer: extra.businessFooter || ''
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtMoney(v, currency) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} ${currency}`;
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function buildInvoiceHtml({ client, invoice, items }) {
  const currency = invoice.currency || 'EUR';
  const ht = Number(invoice.total_ht || 0);
  const ttc = Number(invoice.total_ttc || 0);
  const tva = ttc - ht;

  const rows = (items || [])
    .map((it) => {
      const line = Number(it.qty || 0) * Number(it.unit_price || 0);
      return `
        <tr>
          <td>${esc(it.label)}</td>
          <td class="c">${Number(it.qty || 0)}</td>
          <td class="c">${fmtMoney(it.unit_price, currency)}</td>
          <td class="c">${Number(it.tva || 0) ? `${Number(it.tva)}%` : '—'}</td>
          <td class="c">${fmtMoney(line, currency)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111B21; margin: 0; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #075E54; padding-bottom: 16px; }
  .brand { font-size: 20px; font-weight: 800; color: #075E54; }
  .brand-lines { font-size: 11px; color: #667781; margin-top: 4px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 24px; color: #075E54; }
  .doc-title p { margin: 4px 0 0; font-size: 12px; color: #667781; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; }
  .meta .block { font-size: 12px; }
  .meta .block .label { font-weight: 700; color: #667781; text-transform: uppercase; font-size: 10px; }
  .meta .block div { margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #ECE5DD; font-size: 11px; text-transform: uppercase; text-align: left; padding: 8px; }
  th.c, td.c { text-align: right; }
  td { font-size: 13px; padding: 8px; border-bottom: 1px solid #E9EDEF; }
  .totals { margin-top: 16px; margin-left: auto; width: 260px; font-size: 13px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #075E54; font-weight: 800; font-size: 15px; }
  .notes { margin-top: 24px; font-size: 12px; color: #667781; }
  .footer { margin-top: 32px; border-top: 1px solid #E9EDEF; padding-top: 10px; font-size: 11px; color: #667781; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${esc(business.name || '')}</div>
      <div class="brand-lines">${esc(business.line1)}<br/>${esc(business.line2)}</div>
    </div>
    <div class="doc-title">
      <h1>${TYPE_LABELS[invoice.type] || 'Document'}</h1>
      <p>N° ${esc(invoice.number)}</p>
      <p>${STATUS_LABELS[invoice.status] || invoice.status}</p>
    </div>
  </div>

  <div class="meta">
    <div class="block">
      <div class="label">Destinataire</div>
      <div>${esc(client.name)}</div>
      <div>${client.phone ? '+' + esc(client.phone) : ''}</div>
    </div>
    <div class="block" style="text-align:right">
      <div class="label">Émis le</div>
      <div>${fmtDate(invoice.issue_date)}</div>
      ${invoice.due_date ? `<div class="label" style="margin-top:8px">Échéance</div><div>${fmtDate(invoice.due_date)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="c">Qté</th>
        <th class="c">PU HT</th>
        <th class="c">TVA</th>
        <th class="c">Total HT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total HT</span><span>${fmtMoney(ht, currency)}</span></div>
    <div class="row"><span>TVA</span><span>${fmtMoney(tva, currency)}</span></div>
    <div class="row grand"><span>Total TTC</span><span>${fmtMoney(ttc, currency)}</span></div>
  </div>

  ${invoice.notes ? `<div class="notes">Notes : ${esc(invoice.notes)}</div>` : ''}

  <div class="footer">${esc(business.footer)}</div>
</body>
</html>`;
}

// Génère un PDF local et renvoie { uri, base64, numberOfPages }.
export async function generatePdf({ client, invoice, items }) {
  const html = buildInvoiceHtml({ client, invoice, items });
  const { uri, numberOfPages } = await Print.printToFileAsync({ html });
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, base64, numberOfPages };
}

export function invoiceFilename(invoice) {
  const prefix = invoice.type === 'invoice' ? 'facture' : 'devis';
  return `${prefix}-${invoice.number}.pdf`;
}
