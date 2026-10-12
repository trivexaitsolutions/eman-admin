/**
 * Seed deterministic fictional workers across VERIFIED Nakas on a staging DB.
 * Creates 10 Demo Mitras, 10 Demo Customers, and default 200 Demo Workers.
 * Existing demo records are upserted, existing real accounts are untouched.
 * All demo worker & Mitra passwords bcrypt-hashed '1234'. Demo customer OTP
 * 123456 is only issued by send-otp while DEMO_OTP_ENABLED=true.
 *
 * DEMO_DATA_SEED_ALLOWED=YES NODE_ENV=development node scripts/seedDemoOperations.js --execute --workers=200 --mitras=10
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const param = (prefix, fallback) => {
    const arg = args.find(v => v.startsWith(prefix + '='));
    return arg ? Number(arg.slice(prefix.length + 1)) : fallback;
};
const count = param('--workers', 200), mitraCount = param('--mitras', 10), customerCount = param('--customers', 10);
const names1 = ['Aman', 'Ravi', 'Kiran', 'Vikram', 'Rahul', 'Sameer', 'Ganesh', 'Deepak', 'Arjun', 'Rohit', 'Manoj', 'Nilesh', 'Prakash', 'Vijay', 'Sunil', 'Akash', 'Ajay', 'Sanjay', 'Ramesh', 'Anil'];
const names2 = ['Patil', 'Jadhav', 'Shinde', 'Kumar', 'More', 'Shah', 'Pawar', 'Yadav', 'Naik', 'Gupta', 'Deshmukh', 'Singh'];
const phone = i => String(i).padStart(10,'0'); // Reserved non-routable synthetic numbers: 0000000001...
const demoName = i => `${names1[(i-1)%names1.length]} ${names2[Math.floor((i-1)/names1.length)%names2.length]} (Demo ${String(i).padStart(3,'0')})`;
const birth = i => new Date(`${1990 + (i%12)}-06-${String(1+(i%27)).padStart(2,'0')}T00:00:00.000Z`);
const location = naka => `${naka.name}, ${naka.city?.name || 'E-MAN service area'}`;
const findOwner = async (model, existingPhone) => prisma[model].findUnique({ where: { phone: existingPhone }, select: { id: true, isDemo: true } });
async function main(){
 if (!Number.isInteger(count)||count<1||count>5000||!Number.isInteger(mitraCount)||mitraCount<1||mitraCount>50||
     !Number.isInteger(customerCount)||customerCount<0||customerCount>100) throw new Error('Invalid counts');
 const nakas = await prisma.naka.findMany({ where: { verificationStatus:'VERIFIED' },
    include: { city: { select: {name:true} } }, orderBy: { id:'asc' } });
 const skills = await prisma.skill.findMany({ where: { isActive: true }, orderBy: { id:'asc' } });
 if (!nakas.length || !skills.length) throw new Error('At least one VERIFIED Naka and one active Skill required. Existing Nakas/Skills are preserved and used.');
 console.log(`Nakas=${nakas.length}, Skills=${skills.length}, target Demo Mitras=${mitraCount}, Workers=${count}, Customers=${customerCount}`);
 if (!args.includes('--execute')) {console.log('DRY RUN ONLY. Specify --execute after reviewing counts.'); return;}
 if (process.env.NODE_ENV === 'production' || process.env.DEMO_DATA_SEED_ALLOWED !== 'YES') {
   throw new Error('REFUSED: DEMO_DATA_SEED_ALLOWED=YES and NODE_ENV != production required');
 }
 const existingBookings = await prisma.booking.count();
 if (existingBookings) throw new Error('Clear operational bookings before seeding. Do not overwrite workers linked to bookings.');
 const hash = await bcrypt.hash('1234',10);
 const mitras=[];
 for(let i=1;i<=mitraCount;i++){
   const p=phone(9000+i), old=await findOwner('mitra',p);
   if(old && !old.isDemo) throw new Error(`Non-demo Mitra owns reserved phone ${p}`);
   const assignedNakas=nakas.filter((_,index)=>index%mitraCount===i-1);
   const n=nakas[(i-1)%nakas.length];
   const nakaLinks=assignedNakas.length?assignedNakas:[n];
   const data={name:`Demo Mitra ${String(i).padStart(2,'0')}`,phone:p,email:`mitra${String(i).padStart(2,'0')}@demo.eman.test`,
     password:hash,isActive:true,isDemo:true,nakas:{set:nakaLinks.map(v=>({id:v.id}))}};
   const m= old ? await prisma.mitra.update({ where:{id:old.id},data }) :
     await prisma.mitra.create({data:{...data,nakas:{connect:nakaLinks.map(v=>({id:v.id}))}}});
   mitras.push(m);
 }
 for(let i=1;i<=count;i++){
   const p=phone(i), old=await findOwner('worker',p);
   if(old && !old.isDemo) throw new Error(`Non-demo Worker owns reserved phone ${p}`);
   const nakaIndex=(i-1)%nakas.length;
   const n=nakas[nakaIndex], s=skills[(i-1)%skills.length], m=mitras[nakaIndex%mitras.length];
   const dob=birth(i);
   const data={ name:demoName(i),phone:p,email:`worker${String(i).padStart(3,'0')}@demo.eman.test`,password:hash,dob,
      age:2026-dob.getUTCFullYear(),idProofType:'VOTING',idNumber:`DEMO-ID-${String(i).padStart(5,'0')}`,
      otherIdNumber:`DEMO-ID-${String(i).padStart(5,'0')}`,address:location(n),pincode:n.pincode || '000000',
      isDemo:true,isActive:true,isAvailable:false,lastActive:new Date(0),availabilityType:null,
      availabilityStart:null,availabilityUntil:null,availabilityHours:null,availabilityPoolSlotId:null,mitraId:m.id,
      nakas:{set:[{id:n.id}]},skills:{set:[{id:s.id}]}};
   if(old) await prisma.worker.update({ where:{id:old.id},data });
   else await prisma.worker.create({data:{...data,nakas:{connect:[{id:n.id}]},skills:{connect:[{id:s.id}]}}});
   if(i%50===0) console.log(`Seeded ${i}/${count} demo workers`);
 }
 for(let i=1;i<=customerCount;i++){
   const p=phone(8000+i), old=await findOwner('customer',p);
   if(old && !old.isDemo) throw new Error(`Non-demo Customer owns reserved phone ${p}`);
   const data={name:`Demo Customer ${i}`,phone:p,email:`customer${i}@demo.eman.test`,
      isDemo:true,isVerified:true,mitraId:mitras[(i-1)%mitras.length].id,
      otp:null,otpExpiry:null};
   const c=old ? await prisma.customer.update({where:{id:old.id},data})
                : await prisma.customer.create({data});
   const n=nakas[(i-1)%nakas.length];
   const addressData={ customerId:c.id,title:'Demo Work Site',fullName:c.name,phone:c.phone,
      addressLine:location(n),addressDetail:location(n),mapAddress:location(n),
      cityId:n.cityId,city:n.city?.name || null,nakaId:n.id,nakaName:n.name,
      pincode:n.pincode||'000000',latitude:n.latitude==null?null:String(n.latitude),
      longitude:n.longitude==null?null:String(n.longitude),isDefault:true,locationSource:'MANUAL' };
   const existingAddress=await prisma.customerAddress.findFirst({where:{customerId:c.id,title:'Demo Work Site'},select:{id:true}});
   if(existingAddress) await prisma.customerAddress.update({where:{id:existingAddress.id},data:addressData});
   else await prisma.customerAddress.create({data:addressData});
 }
 console.log('Seed done: dummy phone 0000000001.., Demo Worker/Mitra password=1234 (bcrypt). For demo customer OTP use send-otp with DEMO_OTP_ENABLED=true.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
