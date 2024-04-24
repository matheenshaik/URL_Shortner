const urlModel = require('../model/urlModel')
const validUrl = require('valid-url')
const shortid = require('shortid')
const redis = require("redis");
const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
    12705,
    "redis-12705.c264.ap-south-1-1.ec2.redns.redis-cloud.com",
    { no_ready_check: true } //inhibit checking
);
redisClient.auth("38EIdvVda4jSyAAWY2mSt0JzRgoJJhzA", function (err) {
    if (err) throw err
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..")    
});



//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

//------------------------------------------------------------common Validation-------------------------------------------------------//
const isValid = function (value) {
    if (typeof value == "undefined" || value == null) return false;
    if (typeof value == "string" && value.trim().length == 0) return false;
    if (typeof value == "number") return false;
    return true;
}
const isValidBody = function (value) {
    if (Object.keys(value).length == 0) return true
    return false
}

//<=================================================== Create URL API===================================================================>

const createURL = async function (req, res) {
    try {
        let data = req.body
        //checking body validation
        if (isValidBody(data)) {
            return res.status(400).send({ status: false, message: "Please Provide data" })
        }

        const longUrl = data.longUrl
        //checking longUrl validation
        if (!isValid(longUrl)) {
            return res.status(400).send({ status: false, message: "Please provide only long URL" })
        }

        if (!validUrl.isWebUri(longUrl)) {
            return res.status(400).send({ status: false, message: "Please provide valid URL" })
        }
        //get data from cache for checking unique longurl
        let cachedUniqueUrlData = await GET_ASYNC(`${longUrl}`)
        cachedData = JSON.parse(cachedUniqueUrlData)
        if (cachedData) {
            return res.status(200).send({ status: true, shortUrl: cachedData.shortUrl })
        }

        let uniqueUrl = await urlModel.findOne({ longUrl: longUrl })
        //set data to cache
        await SET_ASYNC(`${longUrl}`, JSON.stringify(uniqueUrl));
        if (uniqueUrl) {
            redisClient.expire(`${uniqueUrl}`, 300, function(err, data) {
                if (err) {
                    console.log(err.message)
                } else {
                    console.log("TTL set for long URL key:", data)
                }
            });
            return res.status(201).send({ status: true, shortUrl: uniqueUrl.shortUrl })
        }
        //generating url code
        const urlCode = shortid.generate().toLowerCase()

        //creating short url
        let baseUrl = "http://localhost:3000/"
        let shortUrl = baseUrl + urlCode
        //making response Data
        let Data = {
            "longUrl": longUrl,
            "shortUrl": shortUrl,
            "urlCode": urlCode
        }
        //creating Data inside DataBase
        await urlModel.create(Data)
        return res.status(201).send({ status: true, message: "URL shortened Successfully", data: Data })

    }
    catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

//<=================================================== Get URL API===================================================================>

const getUrl = async function (req, res) {
    try {
        const urlCode = req.params.urlCode
        redisClient.expire(`${urlCode}`, 300, function(err, data) {
            if (err) {
                console.log(err)
            } else {
                console.log("TTL set for URL code key:", data)
            }
        });
        let cachedData = await GET_ASYNC(`${urlCode}`)
        cachedData = JSON.parse(cachedData)
        if (cachedData) {
            return res.status(302).redirect(cachedData)
        }
        else {
            let findURL = await urlModel.findOne({ urlCode: urlCode })
            if (!findURL) return res.status(404).send({ status: false, message: "No URL Found" })
            await SET_ASYNC(`${urlCode}`, JSON.stringify(findURL.longUrl))
            return res.status(302).redirect(findURL.longUrl)
        }

    }
    catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}



module.exports = { createURL, getUrl }
