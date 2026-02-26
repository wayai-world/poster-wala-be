const env = require("dotenv");
env.config({ path: "./config.env" })

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');

const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./utils/globalErrorHandler');
const authRoute = require('./routes/authRoutes');
const companyRoute = require('./routes/companyRoute');
const advertiserRoute = require('./routes/advertiserRoute');
const leadRoute = require('./routes/leadRoute');
const bookingRoute = require('./routes/bookingRoute');
const reviewRoute = require('./routes/reviewRoute');
const userRoute = require('./routes/userRoute');
const analyticsRoute = require('./routes/analyticsRoute');
// const companyRoute = require('./Routes/advertiserRoute');
const path = require('path');

const cors = require('cors');
const als = require("./utils/als");

const app = express();
app.use((req, res, next) => {
    als.run({}, () => next());
});
app.use(cors({
    origin: process.env.ALLOW_ORIGINS.split(","),
    credentials: true,
    optionsSuccessStatus: 200
}))


app.use(express.static(path.join(__dirname, 'Public')))

const PORT = process.env.PORT || 3000;

app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
require("./utils/tenantAlsHook");

app.use(cookieParser())
// const redisClient = redis.createClient();

mongoose.connect(process.env.DATABASE_URL, {

})
    .then((con) => {
        console.log("*****  DATABASE CONNECTED *****");
    }).catch(e => {
        console.log("not connected", e);
    })



app.use('/api/v1/auth', authRoute);
app.use("/api/v1/company", companyRoute)
app.use('/api/v1/review', reviewRoute)
app.use("/api/v1/advertising-boards", advertiserRoute)
app.use('/api/v1/lead', leadRoute)
app.use('/api/v1/booking', bookingRoute)
app.use('/api/v1/user', userRoute)
app.use('/api/v1/analytics', analyticsRoute)


app.all("*", (req, res) => {
    res.status(404).send({
        status: "error",
        msg: "please hit valid url"
    })
})

app.use(globalErrorHandler)



app.listen(PORT, () => {
    console.log("-------SERVER STARTED ----  :  ", PORT);
})

// syncViewCounts();


/*
TODO: 
panel for advertiser(1), user, admin
operations to create posters to advertiser 

*/










