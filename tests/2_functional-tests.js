const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  test('Create an issue with every field', function (done){
      chai
          .request(server)
          .post('/api/issues/apitest')
          .send({
              'issue_title': 'test issue',
              'issue_text': 'test issue',
              'created_by': 'George',
              'assigned_to': 'Vlad',
              'status_text': 'In QA'
          })
          .end((err, res) => {
              assert.equal(res.status, 200);
              assert.equal(res.type, 'application/json');
              assert.equal(res.body.issue_title, 'test issue');
              assert.equal(res.body.issue_text, 'test issue');
              assert.equal(res.body.created_by, 'George');
              assert.equal(res.body.assigned_to, 'Vlad');
              assert.equal(res.body.status_text, 'In QA');
              done();
          })
  })

    test('Create an issue with only required fields', function (done){
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_title': 'test issue',
                'issue_text': 'test issue',
                'created_by': 'George'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.issue_title, 'test issue');
                assert.equal(res.body.issue_text, 'test issue');
                assert.equal(res.body.created_by, 'George');
                assert.equal(res.body.assigned_to, '');
                assert.equal(res.body.status_text, '');
                done();
            })
    })

    test('Create an issue with missing required fields', function (done) {
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_text': 'Where is the title?!',
                'created_by': 'Someone inept...'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.error, 'required field(s) missing');
                done();
            })
    })

    test('View issues on a project', function (done) {
        chai
            .request(server)
            .get('/api/issues/apitest')
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.isArray(res.body);
                done();
            })
    })

    test('View issues on a project with one filter', done => {
        chai
            .request(server)
            .get('/api/issues/apitest')
            .query({'open': 'true'})
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.isArray(res.body);
                res.body.forEach(issue => {
                    assert.propertyVal(issue, 'open', true);
                })
                done();
            })
    })

    test('View issues on a project with multiple filters', done => {
        chai
            .request(server)
            .get('/api/issues/apitest')
            .query({
                'open': 'true',
                'assigned_to': 'George'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.isArray(res.body);
                res.body.forEach(issue => {
                    assert.propertyVal(issue, 'open', true);
                    assert.propertyVal(issue, 'assigned_to', 'George');
                })
                done();
            })
    })

    test('Update one field on an issue', done => {
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_title': 'test issue',
                'issue_text': 'test issue',
                'created_by': 'George',
                'assigned_to': 'Vlad',
                'status_text': 'In QA'
            })
            .then(initRes => {
                chai.request(server)
                    .put('/api/issues/apitest')
                    .send({
                        _id: initRes.body._id,
                        open: false
                    })
                    .then(res => {
                        assert.equal(res.status, 200);
                        assert.equal(res.type, 'application/json');
                        assert.equal(res.body.result, 'successfully updated');
                        assert.equal(res.body._id, initRes.body._id);
                        chai.request(server)
                            .get('/api/issues/apitest')
                            .query({_id: initRes.body._id})
                            .end((err, res1) => {
                                assert.equal(res1.status, 200);
                                res1.body.forEach(issue => {
                                    assert.equal(issue._id, initRes.body._id);
                                    assert.equal(issue.open, false);
                                    assert.notEqual(issue.created_on, issue.updated_on);
                                })

                                done();
                            })
                    })
            })

    })

    test('Update multiple fields on an issue', done => {
        //first create an issue to mess around with
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_title': 'test issue',
                'issue_text': 'test issue',
                'created_by': 'George',
                'assigned_to': 'Vlad',
                'status_text': 'In QA'
            })
            .then(initRes => {
                //once issue created, update it
                chai
                    .request(server)
                    .put('/api/issues/apitest')
                    .send({
                        _id: initRes.body._id,
                        open: false,
                        assigned_to: 'Estragon'
                    })
                    .then(res => {
                        //check we have a successful response
                        assert.equal(res.status, 200);
                        assert.equal(res.type, 'application/json');
                        assert.equal(res.body.result, 'successfully updated');
                        assert.equal(res.body._id, initRes.body._id);
                        chai
                            .request(server)
                            .get('/api/issues/apitest')
                            .query({_id: initRes.body._id})
                            .end((err, res1) => {
                                //finally, make sure the fields have updated as expected
                                assert.equal(res1.status, 200);
                                res1.body.forEach(issue => {
                                    assert.equal(issue._id, initRes.body._id);
                                    assert.equal(issue.open, false);
                                    assert.equal(issue.assigned_to, 'Estragon');
                                    assert.notEqual(issue.created_on, issue.updated_on);
                                })
                                done();
                            })
                    })
            })

    })

    test('Update an issue with missing _id', done => {
        //don't bother creating an issue as we aren't gonna modify one
        chai
            .request(server)
            .put('/api/issues/apitest')
            .send({
                open: false,
                assigned_to: 'Estragon'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.error, 'missing _id');
                done();
            })

    })

    test('Update an issue with no fields to update', done => {
        //first create an issue to mess around with
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_title': 'test issue',
                'issue_text': 'test issue',
                'created_by': 'George',
                'assigned_to': 'Vlad',
                'status_text': 'In QA'
            })
            .then(initRes => {
                //once issue created, update it
                chai
                    .request(server)
                    .put('/api/issues/apitest')
                    .send({
                        _id: initRes.body._id,
                    })
                    .then(res => {
                        //check we have a successful response
                        assert.equal(res.status, 200);
                        assert.equal(res.type, 'application/json');
                        assert.equal(res.body.error, 'no update field(s) sent');
                        assert.equal(res.body._id, initRes.body._id);
                        done();
                    })
            })

    })

    test('Update an issue with an invalid _id', done => {
        //don't bother creating an issue as we aren't gonna modify one
        chai
            .request(server)
            .put('/api/issues/apitest')
            .send({
                _id: 'peepeepoopoo',
                open: false
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.error, 'could not update');
                assert.equal(res.body._id, 'peepeepoopoo');
                done();
            })

    })

    test('Delete an issue', done => {
        //first create an issue to mess around with
        chai
            .request(server)
            .post('/api/issues/apitest')
            .send({
                'issue_title': 'test issue',
                'issue_text': 'test issue',
                'created_by': 'George',
                'assigned_to': 'Vlad',
                'status_text': 'In QA'
            })
            .then(initRes => {
                //once issue created, delete it
                chai
                    .request(server)
                    .delete('/api/issues/apitest')
                    .send({
                        _id: initRes.body._id
                    })
                    .then(res => {
                        //check we have a successful response
                        assert.equal(res.status, 200);
                        assert.equal(res.type, 'application/json');
                        assert.equal(res.body.result, 'successfully deleted');
                        assert.equal(res.body._id, initRes.body._id);
                        chai
                            .request(server)
                            .get('/api/issues/apitest')
                            .query({_id: initRes.body._id})
                            .end((err, res1) => {
                                //finally, make sure the record has been deleted as expected
                                assert.equal(res1.status, 200);
                                assert.isArray(res1.body);
                                assert.isEmpty(res1.body);
                                done();
                            })
                    })
            })

    })

    test('Delete an issue with an invalid _id', done => {
        //don't bother creating an issue as we aren't gonna modify one
        chai
            .request(server)
            .delete('/api/issues/apitest')
            .send({
                _id: 'peepeepoopoo'
            })
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.error, 'could not delete');
                assert.equal(res.body._id, 'peepeepoopoo');
                done();
            })

    })

    test('Delete an issue with missing _id', done => {
        //don't bother creating an issue as we aren't gonna modify one
        chai
            .request(server)
            .delete('/api/issues/apitest')
            .send()
            .end((err, res) => {
                assert.equal(res.status, 200);
                assert.equal(res.type, 'application/json');
                assert.equal(res.body.error, 'missing _id');
                done();
            })

    })


});
