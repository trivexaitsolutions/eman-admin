// utils/sendNotification.js
const { Expo } = require('expo-server-sdk');

// Naya Expo client banayein
let expo = new Expo();

const sendPushNotification = async (pushToken, title, body, data = {}) => {
    // 1. Check karein ki token sahi format me hai ya nahi
    if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        return false;
    }

    // 2. Message ka format tayar karein
    let messages = [{
        to: pushToken,
        sound: 'default',
        title: title,       // Jaise: "🎉 NAYA KAAM MIL GAYA!"
        body: body,         // Jaise: "Station East naka par jaldi pahocho"
        data: data,         // Extra info (Customer ka naam, phone number etc.)
    }];

    // 3. Message bhejein
    try {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log("Notification Ticket:", ticketChunk);
        }
        return true;
    } catch (error) {
        console.error("Notification bhejne me error:", error);
        return false;
    }
};

module.exports = { sendPushNotification };