const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const jwt= require('jsonwebtoken');
const app = require('../server');
const { TEST_MONGODB_URI, JWT_SECRET } = require('../config');

const Note = require('../models/note');
const Folder = require('../models/folder');
const Tag = require('../models/tags');
const User = require('../models/user');

const { folders, notes, tags, users } = require('../db/seed/data');

const expect = chai.expect;
chai.use(chaiHttp);

describe('sanity check' ,function(){


  it('true should be true', function(){
    expect(true).to.be.true;
  });

  it('1+1 should equal 2', function(){
    expect(1+1).to.equal(2);
  });

});


describe('Connect, createdb, drodb, disconnect', function(){
  before(function () {
    return mongoose.connect(TEST_MONGODB_URI, { useNewUrlParser: true })
      .then(() => mongoose.connection.db.dropDatabase());
  });


  let token;
  let user;

  beforeEach(function () {
    return Promise.all([
      User.insertMany(users),
      Folder.insertMany(folders),
      Folder.createIndexes(),
      Tag.insertMany(tags),
      Tag.createIndexes(),
      Note.insertMany(notes)
    ])
      .then(([users]) => {
        user = users[0];
        token = jwt.sign({ user }, JWT_SECRET, { subject: user.username });
      });
  });
    
  afterEach(function () {
    return mongoose.connection.db.dropDatabase();
  });
    
  after(function () {
    return mongoose.disconnect();
  });

  //==================GET api/Notes ==============================

  describe('GET api/folders/', function(){
     
    it('Should return all folders', function(){
      let allfolders;
      console.log('RETURN ALL FOLDERS');
      
      return Folder.find({userId: user.id})
        .then((response)=>{
          allfolders= response;
          // console.log('===='+response +'====');
          // console.log('==ALL=='+allfolders);
          return chai.request(app)
            .get('/api/folders')
            .set('Authorization', `Bearer ${token}`); 
        })
        .then((res)=>{
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);
          // console.log(res.body);
          expect(res.body[0]).to.be.a('object');
          expect(res.body.length).to.equal(allfolders.length);
        });
    });
    it('should return a list with the correct right fields', function () {
      const dbPromise = Folder.find({ userId: user.id }); 
      const apiPromise = chai.request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`); 
    
      return Promise.all([dbPromise, apiPromise])
        .then(([data, res]) => {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          res.body.forEach(function (item) {
            expect(item).to.be.a('object');
            expect(item).to.have.keys('id', 'name', 'userId', 'createdAt', 'updatedAt');  // <<== Update assertion
          });
        });
    });



  });

  //==================GET api/Notes/id ==============================
  describe('GET /api/folders/:id', function () {
    it('should return correct folder', function () {
      console.log('RETURN FOLDER BY CORRECT ID');
      let note;
      let folder;

      //insert Notes and grab folder ID from Notes
      return Note.findOne({folderId : {$exists:true}, userId: user.id})
       
        .then((notesResult)=>{
          note = notesResult;
          // console.log("======" +notesResult+"======" );
          // console.log("======" +user.id+"======" );
          return chai.request(app).get(`/api/folders/${note.folderId}`)
            .set('Authorization', `Bearer ${token}`); 
        })
        .then((res) => {
          folder=res;
          //   console.log(folder.body);
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.keys('name', 'createdAt', 'updatedAt', 'id', 'userId');
          // 3) then compare database results to API response
          expect(res.body.name).to.equal(folder.body.name);
          //expect(new Date(res.body.createdAt.toString())).to.equal(folder.body.createdAt.toString());
        //   expect(new Date(res.body.updatedAt)).to.eql(folder.body.updatedAt);
        }); 
    });


    it('respond with error for invalid ID', function () {
      const invalidId = 'doReMi';
      return chai.request(app)
        .get(`/api/folders/${invalidId}`)
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body.message).to.equal(`Folder Id: ${invalidId} is not valid`);
        });
    });

  });

  //==================POST api/notes ==============================
  describe('POST /api/folders', function(){
    it('should create a note in the DB and return it to the user', function(){
      console.log('CREATE FOLDER AND RETURN SAME FOLDER');

      const newFolder = {name: 'New Folder Test'};
      let newFolderRes;
      return chai.request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send(newFolder)
        .then((res)=>{
          newFolderRes = res;
          //console.log(newFolderRes);
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res).to.be.a('object');
          expect(res.body.name).to.equal(newFolder.name);
          //console.log(JSON.stringify(res.body) + "=========");
          expect(res).to.have.header('location');
          //expect(res.headers.location).to.equal(`/api/folders/${res.body.id}`);
          expect(new Date(res.body.createdAt)).to.not.equal(null);
          expect(new Date(res.body.updatedAt)).to.not.equal(null);
          expect(res.body).to.have.keys('name', 'createdAt', 'updatedAt', 'id', 'userId');
          return Folder.findOne({name: res.body.name});
        })
        .then((results)=>{
          //console.log(results);
          expect(results.name).to.equal(newFolderRes.body.name);
          expect(new Date(results.createdAt)).to.eql(new Date(newFolderRes.body.createdAt));
          expect(new Date(results.updatedAt)).to.eql(new Date(newFolderRes.body.updatedAt));
        });

    });
  });


  //==================PUT api/notes/id ==============================
  describe('update folder\'s fields by id number', function(){
    it('update correct folder located its id, and return updated folder', function(){
      const updateFolder = {
        name: 'updated name test',
      };
    
      let dbFolder;
      return Folder
        .findOne({userId: user.id})
        .then(function(dbRes) {
          dbFolder= dbRes;
     
          //console.log(dbRes);
          return chai.request(app)
            .put(`/api/folders/${dbRes.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateFolder);
        })
        .then((res)=>{
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res).to.be.a('object');
          expect(res.body.name).to.equal(updateFolder.name);
          expect(new Date(res.body.createdAt)).to.eql(new Date(dbFolder.createdAt));
          return chai.request(app)
            .get(`/api/folders/${dbFolder.id}`)
            .set('Authorization', `Bearer ${token}`);
        })
        .then((chaiRes)=>{
          expect(chaiRes).to.have.status(200);
          expect(chaiRes).to.be.json;
          expect(chaiRes).to.be.a('object');
          expect(chaiRes.body.name).to.equal(updateFolder.name);
        });
    });

  });

  //==================DELETE api/notes/id ==============================
  describe('DELETE BY ID', function() {
 
    it('deletes a folder by id', function() {

      let folder;

      return Folder
        .findOne({userId: user.id})
        .then(function(dbFolder) {
          folder = dbFolder;
          return chai.request(app).delete(`/api/folders/${folder.id}`)
            .set('Authorization', `Bearer ${token}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return Folder
            .findById(folder.id);
        })
        .then(function(dbNote) {
          expect(dbNote).to.be.null;
          
        });
    });
  });

  //Need to add more tests to make sure associated notes aren't deleted

//=============================================================
});