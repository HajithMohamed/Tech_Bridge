import catalog from './communityDirectory.json';
export const directoryContacts = catalog.contacts;
export const directorySources = catalog.sources;
export const findDirectoryContact = (id: string) => directoryContacts.find((contact) => contact.id === id);
export const directoryInstitution = 'University of Ruhuna';
