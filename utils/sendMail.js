
// we will send email 
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {

    // create transpoder //nodemailer
    console.log("came inside");

    const transpoder = nodemailer.createTransport({
        host: 'smtp.elasticemail.com',
        port: 2525,
        auth: {
            user: 'bhagatchandan287@gmail.com',
            pass: '755D776950E9299C3ADAA1A6F554BE671733'

        },
    })



    // we need to define the options 

    const body = {
        from: "bhagatchandan287@gmail.com",
        to: "bhagatchandan287@gmail.com",
        subject: "testing",
        text: "new end msg.....",
    }

    // we need to send the mail
    console.log("inprocesss");

    await transpoder.sendMail(body)







}


module.exports = sendEmail;















