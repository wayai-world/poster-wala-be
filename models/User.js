
const mongoose = require("mongoose")
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// creating schema
const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, "name should be provided"],
        maxLength: [25, "name should not exceed 25 character"],
        minLenght: [5, "name should be atleast 5 character"],
        trim: true
    },
    email: {
        unique: true,
        type: String,
        required: [true, "email is required"],

        trim: true

    },
    mobile: {
        type: Number,
        required: [true, "mobile number is required"],

        trim: true

    },
    addressLine1: {
        type: String,
        maxLength: [250, "address should not exceed 250 character"],
        minLenght: [5, "address to be more than 5 character"],
        trim: true

    },
    role: {
        // type: String,
        // enum: ["USER", "ADMIN", "ADVERTISER"],
        // default: "USER"
        type: mongoose.mongo.ObjectId,
        ref: "role",
        required: [true, "role is required"]
    },
    password: {
        type: String,
        required: [true, "password is required "],
        select: false,
        trim: true

    },

    state: {

        type: String,
        required: [true, "state is required"],
        trim: true


    },
    pinCode: {
        type: Number,
        required: [true, "pincode is required"],
        trim: true


    },


    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordExpires: Date,



    ofCompany: {
        type: mongoose.mongo.ObjectId,
        ref: "company"
    },
    deviceTokens: {
        type: [Object]
    }


})

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next()
    }

    this.password = await bcrypt.hash(this.password, 12);

    next()

})



userSchema.methods.correctPass = async function (inputpassword, password) {
    let t = await bcrypt.compare(inputpassword, password)
    console.log(t);
    return t
}

userSchema.methods.IsPasswordChanged = function (time) {
    if (this.passwordChanged) {
        let timeChanged = this.passwordChanged.getTime() / 1000;

        return time < timeChanged
    }

    return false;
}


userSchema.methods.changedPasswords = async function (jwttokentime) {
    if (this.changedPasswodTime) {
        const change = parseInt(this.changedPasswodTime.getTime() / 1000, 10)
        // console.log(jwttokentime, this.changedPasswodTime.getTime() / 1000);
        // console.log(jwttokentime, change);
        // console.log(jwttokentime < change);
        return jwttokentime < change
    }


    // if user has not change the password at least once 
    return false;
}

// now creating model out of schema 
// setting password reset token inENC

userSchema.methods.setPasswordRestToken = function () {
    let tokenO = crypto.randomBytes(32).toString('hex')



    let token = crypto.createHash('sha256').update(tokenO).digest('hex');

    this.passwordResetToken = token;
    this.passwordExpires = Date.now() + 10 * 60 * 60 * 1000;

    return tokenO;


}



const User = mongoose.model('user', userSchema);
module.exports = User;














