
const Redis = require("../Redis");
const SessionPayload = require("./SessionPayload");

class RedisSessionPayload extends SessionPayload {

    savePayload (key, payload, expireTime) {
        if (key.startsWith(Redis.join(""))) {
            key = key.replace(Redis.join(""), "");
        }
        return Redis.set(key, JSON.stringify(payload), expireTime);
    }
    
    readPayload (key) {
        if (key.startsWith(Redis.join(""))) {
            key = key.replace(Redis.join(""), "");
        }
        return Redis.get(key).then((payload) => {
            if (payload) {
                try {
                    payload = JSON.parse(payload);
                } catch (err) {
                    payload = null;
                }
            }
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        if (key.startsWith(Redis.join(""))) {
            key = key.replace(Redis.join(""), "");
        }
        return Redis.del(key).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return resolve([ Redis.join(this.session.formatKey(userid)) ]);
            }
            Redis.do("keys", [ Redis.join(this.session.formatKey(userid, "*")) ], (err, keys) => {
                if (err) return reject(err);
                resolve(keys);
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        if (key.startsWith(Redis.join(""))) {
            key = key.replace(Redis.join(""), "");
        }
        return Redis.setExpireTime(key, expireTime).then(() => {
            return Promise.resolve();
        });
    }
}

module.exports = RedisSessionPayload;