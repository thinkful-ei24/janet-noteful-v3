'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
//const localStrategy = require('../passport/local'); 




const options = {session: false, failWithError: true};

const localAuth = passport.authenticate('local', options);

router.post('/',localAuth, (req,res,next)=>{
  return res.json(req.user);
});



module.exports= router;