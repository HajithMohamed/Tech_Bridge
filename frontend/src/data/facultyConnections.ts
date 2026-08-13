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

export const academicStaff: FacultyConnection[] = [
  { id: 'ict-chandana', category: 'academic', name: 'Dr. H.M. Chandana Pushpakumara', role: 'Head of Department & Senior Lecturer Grade II', department: 'ICT', expertise: 'Information and Communication Technology', email: 'chandanap@ictec.ruh.ac.lk' },
  { id: 'ict-subash', category: 'academic', name: 'Prof. P.K.S.C. Jayasinghe', role: 'Professor', department: 'ICT', expertise: 'IT in agriculture, image retrieval, GIS, remote sensing and HCI', email: 'subash@ictec.ruh.ac.lk' },
  { id: 'ict-laksiri', category: 'academic', name: 'Mr. P.H.P.N. Laksiri', role: 'Lecturer (Probationary)', department: 'ICT', expertise: 'Enterprise application development and image processing', email: 'phpnlaksiri@ictec.ruh.ac.lk' },
  { id: 'ict-rumeshika', category: 'academic', name: 'Ms. Rumeshika W. Arachchi', role: 'Lecturer (Probationary)', department: 'ICT', email: 'rumeshika@ictec.ruh.ac.lk' },
  { id: 'ict-malsha', category: 'academic', name: 'Ms. Malsha Prabuddhi', role: 'Lecturer (Probationary)', department: 'ICT', email: 'malsha@ictec.ruh.ac.lk' },
  { id: 'et-vitharana', category: 'academic', name: 'Dr. V.H.P. Vitharana', role: 'Head of Department & Senior Lecturer', department: 'ET', email: 'hashini@etec.ruh.ac.lk' },
  { id: 'et-ajward', category: 'academic', name: 'Dr. A.M. Ajward', role: 'Senior Lecturer', department: 'ET', email: 'ajward@etec.ruh.ac.lk' },
  { id: 'et-ganege', category: 'academic', name: 'Eng. Ms. H.C. Ganege', role: 'Senior Lecturer Grade II', department: 'ET', email: 'hasiniganege@etec.ruh.ac.lk' },
  { id: 'et-deemantha', category: 'academic', name: 'Eng. Mr. M.B. Akesh Deemantha', role: 'Lecturer (Probationary)', department: 'ET', email: 'deemantha@etec.ruh.ac.lk' },
  { id: 'et-manoj', category: 'academic', name: 'CEng. Mr. J.L.R. Manoj Kumara', role: 'Lecturer (Probationary)', department: 'ET', email: 'manoj@fot.ruh.ac.lk' },
  { id: 'bst-thissa', category: 'academic', name: 'Dr. Thissa Karunarathna', role: 'Head of Department & Senior Lecturer Grade II', department: 'BST', email: 'thissa@btec.ruh.ac.lk' },
  { id: 'bst-wathsala', category: 'academic', name: 'Dr. K.M.W. Rajawaththa', role: 'Senior Lecturer Grade I', department: 'BST', email: 'wathsala@btec.ruh.ac.lk' },
  { id: 'bst-chandani', category: 'academic', name: 'Dr. (Mrs.) H.C.C. De Silva', role: 'Senior Lecturer Grade II', department: 'BST', email: 'chandani@btec.ruh.ac.lk' },
  { id: 'bst-niranjan', category: 'academic', name: 'Dr. Niranjan Kannangara', role: 'Senior Lecturer Grade II', department: 'BST', email: 'niranjan@btec.ruh.ac.lk' },
  { id: 'mds-nilanthi', category: 'academic', name: 'Dr. (Ms.) K.K.N.B. Adikaram', role: 'Head of Department & Senior Lecturer', department: 'MDS', email: 'nilanthi@mstec.ruh.ac.lk' },
  { id: 'mds-indika', category: 'academic', name: 'Dr. Indika P. Kaluarachchige', role: 'Senior Lecturer in Management', department: 'MDS', email: 'indika.k@mstec.ruh.ac.lk' },
  { id: 'mds-navoda', category: 'academic', name: 'Ms. H.M. Navoda N. Herath', role: 'Senior Lecturer Grade II', department: 'MDS', email: 'navodanherath@mstec.ruh.ac.lk' },
];

export const alumniContacts: FacultyConnection[] = [
  { id: 'alumni-rishitha', category: 'alumni', name: 'Rishitha Themiya', role: 'President, Alumni Association', programme: 'Bachelor of ICT (Hons)', workplace: 'Software Engineer, Axiata Digital Labs' },
  { id: 'alumni-chamika-r', category: 'alumni', name: 'Chamika Ravihara', role: 'Vice President, Alumni Association', programme: 'Bachelor of ICT (Hons)', workplace: 'Software Engineer, Epic Technologies Pvt Ltd' },
  { id: 'alumni-kelum', category: 'alumni', name: 'Kelum Nagodavithana', role: 'Secretary, Alumni Association', programme: 'Bachelor of ICT (Hons)', workplace: 'Software Engineer, eBuilder Technology Pvt Ltd' },
  { id: 'alumni-damith', category: 'alumni', name: 'Damith Maduranga', role: 'Deputy Secretary, Alumni Association', programme: 'Bachelor of ET (Hons)', workplace: 'Executive Engineer, MAS Innovation Pvt Ltd' },
  { id: 'alumni-achila', category: 'alumni', name: 'Achila Perera', role: 'Treasurer, Alumni Association', programme: 'Bachelor of ET (Hons)', workplace: 'Biomedical Engineer, Medireps (Pvt) Ltd' },
  { id: 'alumni-mohan', category: 'alumni', name: 'Mohan Perera', role: 'Vice Treasurer, Alumni Association', programme: 'Bachelor of ET (Hons)', workplace: 'Operation Executive, Grand Gain Industrial Ceylon Pvt Ltd' },
  { id: 'alumni-ajintha', category: 'alumni', name: 'Ajintha Sirinaga', role: 'Editor, Alumni Association', programme: 'Bachelor of ET (Hons)', workplace: 'Operation Executive, Grand Gain Industrial Ceylon Pvt Ltd' },
  { id: 'alumni-chamika-l', category: 'alumni', name: 'Chamika Lakmali', role: 'Alumni Association Committee Member', programme: 'Bachelor of ICT (Hons)', workplace: 'Experienced Software Engineer, IFS R&D International' },
  { id: 'alumni-umayanga', category: 'alumni', name: 'Umayanga Kavindi', role: 'National Organizer, Alumni Association', programme: 'Bachelor of ICT (Hons)', workplace: 'Quality Assurance Engineer, Creately' },
];

export const officialFacultySources = {
  academicStaff: 'https://www.tec.ruh.ac.lk/Academic_staff_ICT.php',
  engineeringStaff: 'https://www.tec.ruh.ac.lk/Academic_staff_ET.php',
  biosystemsStaff: 'https://www.tec.ruh.ac.lk/Academic_staff_BST.php',
  multidisciplinaryStaff: 'https://www.tec.ruh.ac.lk/Academic_staff_MDS.php',
  alumni: 'https://www.tec.ruh.ac.lk/alumni/',
  alumniEmail: 'alumni@fot.ruh.ac.lk',
} as const;
