const express = require('express')
const router = express.Router()
const urlController = require('../controller/urlController')


//<-------------------- Create URL API ---------------------------->
router.post("/url/shorten", urlController.createURL)


//<-------------------- GET URL API ---------------------------->
router.get("/:urlCode", urlController.getUrl)

router.all("/*", (req, res) => {
    res.status(400).send({ status: false, message: "please provied valid path" }) 
})



module.exports = router