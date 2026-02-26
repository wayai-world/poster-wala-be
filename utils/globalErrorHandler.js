const appError = require("./appError");



const castErrorHandlerDB = (err) => {
    let message = `invalid ${err.path} with value : ${err.value}`;
    return new appError(message, 400)
}

const dublicateErrorHandlerDB = (err) => {
    let value = Object.values(err.keyValue).join(" ")

    let msgStr = `the field ${Object.keys(err.keyValue).join(" ")}  with value ${value} already existes`
    return new appError(msgStr, 400)
}

const validationErrorHandlerDB = (err) => {
    let errText = Object.values(err.errors).map(el => el.message)
    return new appError(errText.join('. '), 400)
}

const callProdError = (err, req, res) => {
    // console.log(err);
    if (req.originalUrl.startsWith('/api')) {
        if (err.isOperational) {
            err.statusCode = err.statusCode || 500;
            err.status = err.status || 'error'
            return res.status(err.statusCode).json({
                status: err.status,
                msg: err.message
            })
        }
        return res.status(500).json({
            status: 'error',
            msg: 'something went wrong'
        })

    }
    if (err.isOperational) {
        err.statusCode = err.statusCode || 500;
        err.status = err.status || 'error'
        return res.status(err.statusCode).render('errorTemplate', {
            title: "error",
            msg: err.message
        })
    }
    return res.status(err.statusCode).render('errorTemplate', {
        title: "error",
        msg: err.message
    })

}



const callDevError = (err, req, res) => {
    console.log(err, "error");
    if (req.originalUrl.startsWith('/api')) {
        err.statusCode = err.statusCode || 500;
        err.status = err.status || 'error'
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            msg: err.message,
            stack: err.stack
        })
    }
    else {
        err.statusCode = err.statusCode || 500;
        err.status = err.status || 'error'
        res.status(err.statusCode).render('errorTemplate', {
            title: '404 Not Found !',
            msg: err.message
        })
    }
}






module.exports = (err, req, res, next) => {
    // console.log(err);

    // distigushing between env..
    if (process.env.NODE_ENV === 'production') {
        let error;
        if (err.name == 'CastError') {
            error = castErrorHandlerDB(err);
        }

        else if (err.code == 11000) {
            error = dublicateErrorHandlerDB(err)
        }
        else if (err.name == 'ValidationError') {
            error = validationErrorHandlerDB(err)
        }


        callProdError(error || err, req, res)
    } else {
        callDevError(err, req, res);
    }






};