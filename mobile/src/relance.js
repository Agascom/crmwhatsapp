import { TYPE_LABELS } from './store/invoicesStore';

// Prépare un message de relance (jamais envoyé automatiquement :
// l'utilisateur le révise et l'envoie manuellement depuis la conversation).
export function buildRelanceMessage({ client, invoice }) {
  const currency = invoice.currency || 'EUR';
  const amt = `${Number(invoice.total_ttc).toFixed(2).replace('.', ',')} ${currency}`;
  const due = new Date(invoice.due_date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const days = Math.max(1, Math.round((Date.now() - invoice.due_date) / 86400000));
  const label = TYPE_LABELS[invoice.type] || 'document';
  return (
    `Bonjour ${client.name},\n\n` +
    `Un petit rappel concernant ${label} ${invoice.number} de ${amt}, arrivée à échéance le ${due} ` +
    `(il y a ${days} jour${days > 1 ? 's' : ''}).\n\n` +
    `Merci de me tenir informé(e) du règlement.\n\nCordialement.`
  );
}

// Message d'accompagnement quand un devis est envoyé.
export function buildDevisMessage({ client, invoice }) {
  const currency = invoice.currency || 'EUR';
  const amt = `${Number(invoice.total_ttc).toFixed(2).replace('.', ',')} ${currency}`;
  return (
    `Bonjour ${client.name},\n\n` +
    `Veuillez trouver ci-joint le devis ${invoice.number} d'un montant de ${amt}.\n\n` +
    `N'hésitez pas à revenir vers moi pour toute question.\n\nCordialement.`
  );
}
