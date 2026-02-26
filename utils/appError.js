// creating error class 
class appError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${this.statusCode}`.startsWith('4') ? 'fail' : 'error';


        // to identify it is operational and we are sending it in case 
        this.isOperational = true;
    }
}


module.exports = appError;





















