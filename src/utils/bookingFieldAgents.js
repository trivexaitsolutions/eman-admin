// Resolve the contact from workers assigned to THIS booking, not the customer's
// optional onboarding Field Agent. Fallbacks are explicit and lower priority.
const normalizeContact = (agent) => {
  if (!agent || agent.isActive === false) return null;
  const phone = String(agent.phone || '').trim();
  if (!phone) return null;
  return {
    id: Number(agent.id),
    name: String(agent.name || 'Field Agent'),
    phone,
  };
};

const resolveBookingFieldAgents = ({
  bookedWorkers = [],
  workersWithMitra = [],
  cancelledWorkerIds = [],
  customerMitra = null,
  nakaMitra = null,
} = {}) => {
  const activeIds = new Set(bookedWorkers.map(worker => Number(worker.id)));
  const cancelled = new Set(cancelledWorkerIds.map(Number));
  const contacts = new Map();

  for (const worker of workersWithMitra) {
    const workerId = Number(worker.id);
    if (!activeIds.has(workerId) || cancelled.has(workerId)) continue;
    const contact = normalizeContact(worker.mitra);
    if (!contact) continue;
    if (!contacts.has(contact.id)) {
      contacts.set(contact.id, { ...contact, source: 'WORKER', workerIds: [] });
    }
    contacts.get(contact.id).workerIds.push(workerId);
  }

  // A booking with workers from different agents can return all of them.
  if (contacts.size > 0) return Array.from(contacts.values());

  const customerContact = normalizeContact(customerMitra);
  if (customerContact) return [{ ...customerContact, source: 'CUSTOMER', workerIds: [] }];

  const nearbyContact = normalizeContact(nakaMitra);
  if (nearbyContact) return [{ ...nearbyContact, source: 'NAKA', workerIds: [] }];

  return [];
};

module.exports = { resolveBookingFieldAgents };
