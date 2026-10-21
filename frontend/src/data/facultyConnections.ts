import catalog from '../../../backend/src/data/communityDirectory.json';

export type ConnectionCategory = 'academic' | 'alumni';

export interface FacultyConnection {
  id: string;
  category: ConnectionCategory;
  name: string;
  role: string;
  department?: 'ICT' | 'ET' | 'BST' | 'MDS' | 'Faculty';
  expertise?: string;
  email?: string;
  workplace?: string;
  programme?: string;
  availability?: string;
}

export const academicStaff = catalog.contacts.filter((contact) => contact.category === 'academic') as FacultyConnection[];
export const alumniContacts = catalog.contacts.filter((contact) => contact.category === 'alumni') as FacultyConnection[];
export const officialFacultySources = catalog.sources;
