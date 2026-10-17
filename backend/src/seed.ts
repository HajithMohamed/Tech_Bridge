import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';

dotenv.config();

type CommunityContact = { fullName: string; email: string; organizationType: 'faculty' | 'alumni'; description: string };

// Converts the public-only directory into verified TechBridge identities for local/demo use.
const communityContacts: CommunityContact[] = [
  ['Dr. H.M. Chandana Pushpakumara', 'chandanap@ictec.ruh.ac.lk', 'faculty', 'Information and Communication Technology'], ['Prof. P.K.S.C. Jayasinghe', 'subash@ictec.ruh.ac.lk', 'faculty', 'IT in agriculture, image retrieval, GIS, remote sensing and HCI'], ['Mr. P.H.P.N. Laksiri', 'phpnlaksiri@ictec.ruh.ac.lk', 'faculty', 'Enterprise application development and image processing'], ['Ms. Rumeshika W. Arachchi', 'rumeshika@ictec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Ms. Malsha Prabuddhi', 'malsha@ictec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. V.H.P. Vitharana', 'hashini@etec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. A.M. Ajward', 'ajward@etec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Eng. Ms. H.C. Ganege', 'hasiniganege@etec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Eng. Mr. M.B. Akesh Deemantha', 'deemantha@etec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['CEng. Mr. J.L.R. Manoj Kumara', 'manoj@fot.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. Thissa Karunarathna', 'thissa@btec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. K.M.W. Rajawaththa', 'wathsala@btec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. (Mrs.) H.C.C. De Silva', 'chandani@btec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. Niranjan Kannangara', 'niranjan@btec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. (Ms.) K.K.N.B. Adikaram', 'nilanthi@mstec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Dr. Indika P. Kaluarachchige', 'indika.k@mstec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'], ['Ms. H.M. Navoda N. Herath', 'navodanherath@mstec.ruh.ac.lk', 'faculty', 'Faculty of Technology academic staff'],
  ['Rishitha Themiya', 'rishitha.themiya@community.techbridge.lk', 'alumni', 'President, Alumni Association'], ['Chamika Ravihara', 'chamika.ravihara@community.techbridge.lk', 'alumni', 'Vice President, Alumni Association'], ['Kelum Nagodavithana', 'kelum.nagodavithana@community.techbridge.lk', 'alumni', 'Secretary, Alumni Association'], ['Damith Maduranga', 'damith.maduranga@community.techbridge.lk', 'alumni', 'Deputy Secretary, Alumni Association'], ['Achila Perera', 'achila.perera@community.techbridge.lk', 'alumni', 'Treasurer, Alumni Association'], ['Mohan Perera', 'mohan.perera@community.techbridge.lk', 'alumni', 'Vice Treasurer, Alumni Association'], ['Ajintha Sirinaga', 'ajintha.sirinaga@community.techbridge.lk', 'alumni', 'Editor, Alumni Association'], ['Chamika Lakmali', 'chamika.lakmali@community.techbridge.lk', 'alumni', 'Alumni Association Committee Member'], ['Umayanga Kavindi', 'umayanga.kavindi@community.techbridge.lk', 'alumni', 'National Organizer, Alumni Association'],
].map(([fullName, email, organizationType, description]) => ({ fullName, email, organizationType: organizationType as CommunityContact['organizationType'], description }));

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    if (!await User.exists({ role: 'admin' })) {
      await User.create({ fullName: 'TechBridge Admin', email: 'admin@techbridge.lk', password: 'Admin@123', role: 'admin' });
      console.log('Created TechBridge admin (admin@techbridge.lk).');
    }
    let created = 0;
    for (const contact of communityContacts) {
      if (!await User.exists({ email: contact.email })) {
        await User.create({ fullName: contact.fullName, email: contact.email, password: 'Community@123', role: 'provider', providerProfile: { organizationName: contact.fullName, organizationType: contact.organizationType, verified: true, verificationStatus: 'VERIFIED', contactEmail: contact.email, contactPerson: contact.fullName, phone: 'Not listed', location: 'Faculty of Technology, University of Ruhuna', description: contact.description, opportunityCategories: ['mentorship'] } });
        created += 1;
      }
    }
    console.log(`Community seed complete: ${created} accounts created.`);
    process.exit(0);
  } catch (error) { console.error('Seed error:', error); process.exit(1); }
};

void seed();
