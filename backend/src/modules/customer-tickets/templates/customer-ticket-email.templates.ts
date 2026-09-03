import { env } from '../../../config/env.js';
import type { CustomerTicketLifecycleEvent } from '../customer-ticket-events.dispatcher.js';

export function ticketSubmittedSalesEmail(event: CustomerTicketLifecycleEvent) {
  const submittedAt = formatDateTime(event.occurredAt);
  const detailsUrl = `${env.APP_URL.replace(/\/$/, '')}/sales/tickets/${event.ticketId}`;
  const customerName = event.customerCompanyName ?? 'Customer';
  const createdBy = event.customerUserName ?? event.customerUserEmail ?? 'Customer user';
  const description = stringMetadata(event, 'description') ?? 'No description provided.';

  return {
    subject: 'New Customer Service Request Submitted',
    text: [
      'New Service Request',
      '',
      `Ticket: ${event.ticketNumber}`,
      '',
      `Customer: ${customerName}`,
      '',
      `Created By: ${createdBy}`,
      `User Role: ${formatRole(event.customerUserRole)}`,
      '',
      'Description:',
      description,
      '',
      `Submitted At: ${submittedAt}`,
      '',
      `Ticket Details: ${detailsUrl}`,
    ].join('\n'),
    html: [
      '<h2>New Service Request</h2>',
      `<p><strong>Ticket:</strong> ${escapeHtml(event.ticketNumber)}</p>`,
      `<p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>`,
      `<p><strong>Created By:</strong> ${escapeHtml(createdBy)}</p>`,
      `<p><strong>User Role:</strong> ${escapeHtml(formatRole(event.customerUserRole))}</p>`,
      `<p><strong>Description:</strong></p><p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>`,
      `<p><strong>Submitted At:</strong> ${escapeHtml(submittedAt)}</p>`,
      `<p><a href="${escapeHtml(detailsUrl)}">Open Ticket Details</a></p>`,
    ].join('\n'),
  };
}

export function ticketClosedCustomerEmail(event: CustomerTicketLifecycleEvent) {
  const closedAt = formatDateTime(event.occurredAt);
  const detailsUrl = `${env.APP_URL.replace(/\/$/, '')}/customer/tickets/${event.ticketId}`;
  const customerName = event.customerUserName ?? 'Customer';
  const resolution = stringMetadata(event, 'crmResponse') ?? stringMetadata(event, 'resolution') ?? '';

  return {
    subject: 'Your Service Request Has Been Resolved',
    text: [
      `Dear ${customerName},`,
      '',
      'Your service request has been resolved.',
      '',
      `Ticket: ${event.ticketNumber}`,
      '',
      'Resolution:',
      resolution || 'Resolution details are available in the portal.',
      '',
      `Closed At: ${closedAt}`,
      '',
      `Ticket Details: ${detailsUrl}`,
    ].join('\n'),
    html: [
      `<p>Dear ${escapeHtml(customerName)},</p>`,
      '<p>Your service request has been resolved.</p>',
      `<p><strong>Ticket:</strong> ${escapeHtml(event.ticketNumber)}</p>`,
      `<p><strong>Resolution:</strong></p><p>${escapeHtml(
        resolution || 'Resolution details are available in the portal.',
      ).replace(/\n/g, '<br>')}</p>`,
      `<p><strong>Closed At:</strong> ${escapeHtml(closedAt)}</p>`,
      `<p><a href="${escapeHtml(detailsUrl)}">Open Ticket Details</a></p>`,
    ].join('\n'),
  };
}

function stringMetadata(event: CustomerTicketLifecycleEvent, key: string) {
  const value = event.metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatRole(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { timeZone: 'UTC' });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
