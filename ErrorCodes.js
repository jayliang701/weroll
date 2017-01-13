/**
 * Created by Jay on 15-3-29.
 */

module.exports = {
    //system
    "OK": 1,
    "UNKNOWN": 2,
    "NO_SUCH_METHOD": 3,
    "NO_PERMISSION": 100,
    "SERVER_ERROR": 101,
    "REQUEST_PARAMS_INVALID": 102,
    "DB_ERROR": 103,
    "REDIS_ERROR": 104,
    "ECOSYSTEM_ERROR": 105,
    "ILLEGAL_ACTION": 106,
    "SESSION_ERROR": 110,

    //specific
    "DATA_EXISTED": 1000,
    "DATA_NOT_EXISTED": 1001,

    //codes
    "INVALID_VALIDATION_CODE": 1100,

    //sms
    "SMS_SERVICE_ERROR": 1110,
    "SMS_SEND_TOO_FAST": 1111,
    "SMS_SEND_OVER_MAX_TIMES": 1112
}