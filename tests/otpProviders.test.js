'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const realLoad = Module._load;
Module._load = function (name, ...rest) {
    if (name === './apiIntegrations') return { getSettings: async () => ({}) };
    if (name === '../utils/mailer') return { sendOtpEmail: async () => true };
    return realLoad.call(this, name, ...rest);
};
const otpService = require('../src/services/otpDelivery');
Module._load = realLoad;

test('Indian phone is normalized safely', () => {
    assert.equal(otpService.indianPhone('9876543210'), '919876543210');
    assert.equal(otpService.indianPhone('+91-98765 43210'), '919876543210');
    assert.equal(otpService.indianPhone('5550000000'), null);
});
test('MSG91 SMS request sends supplied OTP and handles successful acceptance', async () => {
    const before = global.fetch;
    let sent;
    global.fetch = async (url, opts) => { sent = {url, opts}; return {ok:true,status:200,text:async()=>JSON.stringify({type:'success', request_id:'dummy'})}; };
    try {
        const result = await otpService.sendOtpViaConfiguredProvider({ phone:'9876543210', otp:'654321', settings:{otpProvider:'MSG91_SMS',smsAuthKey:'sms-token',smsTemplateId:'temp-id'} });
        assert.equal(result.sent,true);
        assert.ok(sent.url.includes('template_id=temp-id'));
        assert.ok(sent.url.includes('otp=654321'));
        assert.equal(sent.opts.headers.authkey,'sms-token');
    } finally {global.fetch=before;}
});
test('MSG91 WhatsApp supports separately configured key', async () => {
    const before = global.fetch;
    let sent;
    global.fetch = async (url, opts) => {sent={url, opts};return {ok:true,status:200,text:async()=>JSON.stringify({status:'success', errors:[]})};};
    try {
        const result = await otpService.sendOtpViaConfiguredProvider({phone:'9876543210',otp:'123456',settings:{otpProvider:'MSG91_WHATSAPP',whatsappReuseSmsKey:false,whatsappAuthKey:'separate',whatsappSenderNumber:'919999999999',whatsappTemplateName:'otp_template',whatsappLanguage:'en'}});
        assert.equal(result.sent,true);
        assert.equal(sent.opts.headers.authkey,'separate');
        const body=JSON.parse(sent.opts.body);
        assert.equal(body.payload.template.to_and_components[0].components.body_1.value,'123456');
    } finally {global.fetch=before;}
});
test('Provider type:error must not report success', async () => {
    const before=global.fetch;const old=console.error;console.error=()=>{};
    global.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({type:'error',message:'Invalid authkey'})});
    try {
        const result=await otpService.sendOtpViaConfiguredProvider({phone:'9876543210',otp:'123456',settings:{otpProvider:'MSG91_SMS',smsAuthKey:'invalid',smsTemplateId:'tpl'}});
        assert.equal(result.sent,false);
    } finally {global.fetch=before;console.error=old;}
});
