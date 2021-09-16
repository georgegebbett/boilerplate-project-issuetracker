'use strict';

const log = require('simple-node-logger').createSimpleLogger();

log.setLevel('error');

const admin = require("@google-cloud/firestore/build/protos/firestore_v1_proto_api");

const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
    projectId: 'fcc-issuetracker',
    keyFilename: './service-key.json',
    ignoreUndefinedProperties: true

});

const bodyParser = require('body-parser');

const projectsCollection = db.collection('projects');
const issuesCollection = db.collection('issues');

const searchIssuesByProjectId = (project_id) => {
    log.info('Looking for issues in project', project_id);
    return issuesCollection.where('project_id', '==', project_id);
}
const findProjectByName = (project_name) => {
    log.info('Looking for projects with name', project_name);
    return projectsCollection.where('name', '==', project_name).limit(1);
}

class Issue {
    constructor(issue_title, issue_text, created_by, assigned_to='', status_text='', project_id) {

        this.issue_title = issue_title;
        this.issue_text = issue_text;
        this.created_by = created_by;
        this.assigned_to = assigned_to;
        this.status_text = status_text;
        this.created_on = Firestore.Timestamp.fromDate(new Date());
        this.updated_on = Firestore.Timestamp.fromDate(new Date());
        this.open = true;
        this.project_id = project_id;
        };

}



module.exports = function (app) {

    app.use(bodyParser.urlencoded({ extended: true }));


    app.route('/api/issues/:project')
  
    .get(function (req, res){
      let projectName = req.params.project;
      log.info(req.query);



      findProjectByName(projectName).get()
          .then(projectObj => {
              if (projectObj.size === 0) {
                  log.error('Invalid project requested:', projectName);
                  res.json({Error: 'no such project'});
              } else {
                  projectObj.forEach(project => {
                      log.info('Project found:', project.id, project.data().name);

                      let query = searchIssuesByProjectId(project.id);

                      for (const field in req.query) {
                          let fieldVal = req.query[field];

                          if (field === 'open') {
                              query = query.where(field, '==', (fieldVal === 'true'));
                          } else if (field === '_id') {
                              query = query.where(Firestore.FieldPath.documentId(), '==', fieldVal);
                          } else {
                              query = query.where(field, '==', fieldVal);
                          }
                      }

                      query._queryOptions.fieldFilters.forEach(queryOp => {
                          log.info(queryOp.field.segments[0], queryOp.value);
                      })

                      query.get()
                          .then(issues => {
                              const issue_array = [];
                              issues.forEach(issue => {
                                  const issue_data = issue.data();
                                  issue_array.push({
                                      _id: issue.id,
                                      issue_title: issue_data.issue_title,
                                      issue_text: issue_data.issue_text,
                                      created_on: new Date(issue_data.created_on.toDate()),
                                      updated_on: new Date(issue_data.updated_on.toDate()),
                                      created_by: issue_data.created_by,
                                      assigned_to: issue_data.assigned_to,
                                      open: issue_data.open,
                                      status_text: issue_data.status_text
                                  });
                              })
                              log.info('Issues retrieved:', issue_array);
                              res.json(issue_array);
                              log.info('Response sent');
                          }, error => {
                              log.error('Error retrieving issues', error);
                          })
                  })
              }

          }, (error) => {
              log.error('Error accessing database');
              log.error(error);
          })



    })
    
    .post(function (req, res) {
        let projectName = req.params.project;

        bodyParser.json();

        const createIssue = issue => {
            issuesCollection.add(issue)
                .then(data => {
                    log.info('Issue added at ID', data.id);
                    res.json({
                        _id: data.id,
                        issue_title: issue.issue_title,
                        issue_text: issue.issue_text,
                        created_on: issue.created_on.toDate(),
                        updated_on: issue.updated_on.toDate(),
                        created_by: issue.created_by,
                        assigned_to: issue.assigned_to,
                        open: issue.open,
                        status_text: issue.status_text
                    })
                }, error => {
                    log.error('Error creating issue');
                })
        }

        //catch any missing params here

        if (
            req.body.issue_title === '' ||
            req.body.issue_text === '' ||
            req.body.created_by === '' ||
            !req.body.hasOwnProperty('issue_title') ||
            !req.body.hasOwnProperty('issue_text') ||
            !req.body.hasOwnProperty('created_by')
        ) {
            log.warn('One or more required fields missing');
            res.json({
                error: 'required field(s) missing'
            });
        } else {


            log.info('Creating issue on', projectName);
            findProjectByName(projectName).get()
                .then(projectObj => {
                    //if the project doesn't exist, create it
                    if (projectObj.size === 0) {
                        log.info('Creating new project with name', projectName);
                        projectsCollection.add({name: projectName})
                            .then(data => {
                                    log.info('Project created');
                                    log.info(data.id);

                                    //now build the issue that will be inserted into Firestore

                                    let new_issue = {};

                                    new_issue.issue_title = req.body.issue_title;
                                    new_issue.issue_text = req.body.issue_text;
                                    new_issue.created_by = req.body.created_by;
                                    new_issue.created_on = Firestore.Timestamp.fromDate(new Date());
                                    new_issue.updated_on = Firestore.Timestamp.fromDate(new Date());
                                    new_issue.open = true;
                                    new_issue.project_id = data.id;

                                    //deal with the possible lack of info in the optional fields

                                    for (let optionalValue of ['assigned_to', 'status_text']) {
                                        if (req.body[optionalValue] === undefined) {
                                            new_issue[optionalValue] = '';
                                        } else {
                                            new_issue[optionalValue] = req.body[optionalValue];
                                        }
                                    }

                                    //put the issue in the database

                                    createIssue(new_issue);

                                }, error => {
                                    //if for some reason the project cannot be created
                                    log.error('Unable to create project');
                                }
                            )
                    } else {
                        //this is what we will do if the project already exists
                        projectObj.forEach(project => {
                            //build the new issue
                            let new_issue = {};

                            new_issue.issue_title = req.body.issue_title;
                            new_issue.issue_text = req.body.issue_text;
                            new_issue.created_by = req.body.created_by;
                            new_issue.created_on = Firestore.Timestamp.fromDate(new Date());
                            new_issue.updated_on = Firestore.Timestamp.fromDate(new Date());
                            new_issue.open = true;
                            new_issue.project_id = project.id;

                            //do the optional field stuff
                            //maybe schemas...

                            for (let optionalValue of ['assigned_to', 'status_text']) {
                                if (req.body[optionalValue] === undefined) {
                                    new_issue[optionalValue] = '';
                                } else {
                                    new_issue[optionalValue] = req.body[optionalValue];
                                }
                            }


                            createIssue(new_issue);
                        })
                    }
                }, error => {
                    log.error('Error retrieving project', error);
                })
        }
    })
    
    .put(function (req, res){
      let projectName = req.params.project;

      bodyParser.json();

      log.info(req.body);

      if (req.body._id === '' || req.body._id === undefined) {
          res.json({error: 'missing _id'});
      } else {

          let updatedIssue = {
              updated_on: Firestore.Timestamp.fromDate(new Date())
          }

          let updatedFields = 0;

          for (let updatedValue in req.body) {
              if (req.body[updatedValue] !== '' && updatedValue !== '_id') {
                  if (updatedValue === 'open') {
                      updatedIssue[updatedValue] = (req.body[updatedValue] === 'true');
                  } else {
                      updatedIssue[updatedValue] = req.body[updatedValue];
                  }
                  updatedFields++;
              }
          }

          if (updatedFields === 0) {
              res.json({error: 'no update field(s) sent', '_id': req.body._id})
          } else {


              findProjectByName(projectName).get()
                  .then(project => {
                      project.forEach(projectObj => {
                          log.info(projectObj.id);
                          let query = searchIssuesByProjectId(projectObj.id).where(Firestore.FieldPath.documentId(), '==', req.body._id);

                          query.get()
                              .then(issues => {
                                  if (issues.empty) {
                                      log.error('No results');
                                      res.json({error: 'could not update', _id: req.body._id});
                                  } else {
                                      issues.docs.forEach(issue => {
                                          log.info('Data', issue.data());
                                          issue.ref.update(updatedIssue).then(data => {
                                              log.info('Successful update');
                                              res.json({result: 'successfully updated', '_id': req.body._id});
                                          }, error => {
                                              log.error(error);
                                              res.json({error: 'could not update', _id: req.body._id});
                                          });

                                      })
                                  }

                              }, error => {
                                  log.error('Error retrieving issues');
                              })
                      })
                  }, error => {
                      log.error('Error retrieving project');
                  })
          }
      }
      
    })
    
    .delete(function (req, res){
      let projectName = req.params.project;

      bodyParser.json();

      log.info('Delete req received', req.body);

      if (req.body._id === '' ||  req.body._id === undefined) {
          res.json({'error': 'missing _id'});
      } else {

          findProjectByName(projectName).get()
              .then(project => {
                  project.forEach(projectObj => {
                      log.info('Project found', projectObj.id);
                      let query = searchIssuesByProjectId(projectObj.id).where(Firestore.FieldPath.documentId(), '==', req.body._id);
                      query.get()
                          .then(issues => {
                              if (issues.empty) {
                                  log.error('No such issue');
                                  res.json({error: 'could not delete', '_id': req.body._id});
                              } else {
                                  issues.docs.forEach(issue => {
                                      issue.ref.delete()
                                          .then(
                                              data => {
                                                  res.json({result: 'successfully deleted', '_id': req.body._id});
                                              },
                                              error => {
                                                  res.json({error: 'could not delete', '_id': req.body._id});
                                              }
                                          )
                                  })
                              }
                          })
                  })

              })
      }

      
    });
    
};
