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
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
},
  // ===========================================================================
  // TO-DO: Part A Login unit test case

  describe('/login', () => {

    // Positive test case
    it('positive: /login', (done) => {
      chai.request(server)
        .post('/login')
        .send({ username: 'kkxsiinnmn61', password: 'CSCI_3308' }) 
        .end((err, res) => {
          expect(res).to.have.status(200);
          done();
        });
    });

    //negative test case
    it('negative: /login', (done) => {
      chai.request(server)
        .post('/login')
        .send({ username: 'foo', password: 'foo' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
}));

describe('/register', () => {

    // Positive test case
    it('positive: /register ', (done) => {
      chai.request(server)
        .post('/register')
        .send({ username: 'tyler', password: 'tk' }) 
        .end((err, res) => {
          expect(res).to.have.status(200);
          done();
        });
    });

    //negative test case
    it('negative: /register', (done) => {
      chai.request(server)
        .post('/register')
        .send({ username: 'ywxs6479@colorado.edu', password: 'CSCI_3308' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });
});