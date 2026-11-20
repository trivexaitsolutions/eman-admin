'use strict';
const fs = require('node:fs');
const src = fs.readFileSync('views/admin/api-integrations/index.ejs', 'utf8');
let code = "let __out=''; function __append(x){if(x!==undefined&&x!==null)__out+=String(x)}; with(locals) {\n";
const regex = /<%([=-]?)([\s\S]*?)%>/g;
let last = 0, m;
while ((m = regex.exec(src))) {
    code += '__append('+JSON.stringify(src.slice(last,m.index))+');\n';
    if (m[1] === '=') code += '__append('+m[2].trim()+');\n';
    else if (m[1] === '-') code += '__append('+m[2].trim()+');\n';
    else code += m[2] + '\n';
    last = regex.lastIndex;
}
code += '__append('+JSON.stringify(src.slice(last))+');\n}\nreturn __out;';
const render = new Function('locals', code);
const out = render({ include:()=>'', config:{otpProvider:'MAIL', whatsappReuseSmsKey:true, mailUser:'test@example.com'},csrf:'random-token',encryptionReady:true,saved:false,errorText:null });
if (!out.includes('API Integrations') || !out.includes('otpProvider') || !out.includes('razorpayKeyId')) throw new Error('Missing form fields');
console.log('EJS-compatible template code compiled/rendered:', out.length, 'chars');
