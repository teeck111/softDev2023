// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

module.exports = server;

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
  chai
    .request(server)
    .get('/welcome')
    .end((err, res) => {
      expect(res).to.have.status(200);
      //assert.strictEqual(res.body.message, 'Welcome!'); // Update 'success' to 'Welcome!'
      done();
    });
});


  // TO-DO: Add more test cases for other endpoints...

  describe('/login', () => {
    // Positive test case
    it('positive: /login', (done) => {
      chai.request(server)
        .post('/login')
        .send({ username: 'kkxsiinnmn61', password: 'CSCI_3308' }) 
        .end((err, res) => {
          expect(res).to.have.status(200);
          // TO-DO: Add assertions for successful login
          done();
        });
    });

    // Negative test case
    it('negative: /login', (done) => {
      chai.request(server)
        .post('/login')
        .send({ username: 'foo', password: 'foo' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          // TO-DO: Add assertions for unsuccessful login
          done();
        });
    });
  });

  describe('/register', () => {
    // Positive test case
    it('positive: /register', (done) => {
  chai.request(server)
    .post('/register')
    .send({ email: 'example@example.com', username: 'tyler', password: 'tk1234123' }) 
    .end((err, res) => {
      expect(res).to.have.status(200);
      // Add assertions for successful registration
      done();
    });
});


    // Negative test case
    it('negative: /register', (done) => {
      chai.request(server)
        .post('/register')
        .send({ email: '', username: 'ywxs6479@colorado.edu', password: 'CSCI_3308' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          //assert.strictEqual(res.body.message, 'Email or password invalid');
        done();
    });
    });
  });
});
