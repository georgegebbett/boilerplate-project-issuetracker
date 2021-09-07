'use strict';

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
    console.log('Looking for issues in project', project_id);
    return issuesCollection.where('project_id', '==', project_id);
}
const findProjectByName = (project_name) => {
    console.log('Looking for projects with name', project_name);
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
      console.log(req.query);



      findProjectByName(projectName).get()
          .then(projectObj => {
              if (projectObj.size === 0) {
                  console.log('Invalid project requested:', projectName);
                  res.json({Error: 'no such project'});
              } else {
                  projectObj.forEach(project => {
                      console.log('Project found:', project.id, project.data().name);

                      let query = searchIssuesByProjectId(project.id);

                      for (const field in req.query) {
                          let fieldVal = req.query[field];

                          if (field === 'open') {
                              fieldVal = (fieldVal === 'true');
                          }
                          query = query.where(field, '==', fieldVal);
                      }

                      query._queryOptions.fieldFilters.forEach(queryOp => {
                          console.log(queryOp.field.segments[0], queryOp.value);
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
                              console.log('Issues retrieved:', issue_array);
                              res.json(issue_array);
                              console.log('Response sent');
                          }, error => {
                              console.log('Error retrieving issues', error);
                          })
                  })
              }

          }, (error) => {
              console.log('Error accessing database');
              console.log(error);
          })



    })
    
    .post(function (req, res){
      let projectName = req.params.project;

      const createIssue = issue => {
          issuesCollection.add(issue)
              .then(data => {
                  console.log('Issue added at ID', data.id);
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
                  console.log('Error creating issue');
              })
      }

        const handler = {
            get: function(obj, prop) {
                return prop in obj ?
                    obj[prop] :
                    '';
            }
        };

      console.log('unparsed', req.body);
      bodyParser.json();
      console.log('parsed', req.body);


        if (
            req.body.issue_title === '' ||
            req.body.issue_text === '' ||
            req.body.created_by === '' ||
            !req.body.hasOwnProperty('issue_title') ||
            !req.body.hasOwnProperty('issue_text') ||
            !req.body.hasOwnProperty('created_by')
        ) {
            console.log('One or more required fields missing');
            res.json({
                error: 'required field(s) missing'
            });
        }

      console.log('Creating issue on', projectName);
      findProjectByName(projectName).get()
          .then(projectObj => {

              if (projectObj.size === 0) {
                  console.log('Creating new project with name', projectName);
                  projectsCollection.add({name: projectName})
                      .then( data => {
                          console.log('Project created');
                          console.log(data.id);

                          console.table(req.body);

                          let new_issue = {};

                          new_issue.issue_title = req.body.issue_title;
                          new_issue.issue_text = req.body.issue_text;
                          new_issue.created_by = req.body.created_by;
                          new_issue.created_on = Firestore.Timestamp.fromDate(new Date());
                          new_issue.updated_on = Firestore.Timestamp.fromDate(new Date());
                          new_issue.open = true;
                          new_issue.project_id = data.id;

                          for (let optionalValue of ['assigned_to', 'status_text']) {
                              if (req.body[optionalValue] === undefined) {
                                  new_issue[optionalValue] = '';
                              } else {
                                  new_issue[optionalValue] = req.body[optionalValue];
                              }
                          }

                          console.table(new_issue);

                          createIssue(new_issue);

                          }, error => {
                            console.log('Unable to create project');
                          }

                      )
              } else {
                  projectObj.forEach(project => {
                      let project_id = project.id;
                      let new_issue = {};

                      new_issue.issue_title = req.body.issue_title;
                      new_issue.issue_text = req.body.issue_text;
                      new_issue.created_by = req.body.created_by;
                      new_issue.created_on = Firestore.Timestamp.fromDate(new Date());
                      new_issue.updated_on = Firestore.Timestamp.fromDate(new Date());
                      new_issue.open = true;
                      new_issue.project_id = project.id;

                      for (let optionalValue of ['assigned_to', 'status_text']) {
                          if (req.body[optionalValue] === undefined) {
                              new_issue[optionalValue] = '';
                          } else {
                              new_issue[optionalValue] = req.body[optionalValue];
                          }
                      }

                      console.table(new_issue);

                      createIssue(new_issue);
                  })
              }
          })
          }, error => {
            console.log('Error retrieving project', error);
        }

    )
    
    .put(function (req, res){
      let projectName = req.params.project;

      bodyParser.json();

      console.log(req.body);

      if (req.body._id === '') {
          res.json({error: 'missing _id'});
      }

      let updatedIssue = {
          updated_on: Firestore.Timestamp.fromDate(new Date())
      }

      let updatedFields = 0;

      for (let updatedValue in req.body) {
          if (req.body[updatedValue] !== '' && updatedValue !== '_id') {
              updatedIssue[updatedValue] = req.body[updatedValue];
              updatedFields++;
          }
      }

      if (updatedFields === 0) {
          res.json({error: 'no update field(s) sent', '_id': req.body._id})
      }


      findProjectByName(projectName).get()
          .then(project => {
              project.forEach(projectObj => {
                  console.log(projectObj.id);
                  let query = searchIssuesByProjectId(projectObj.id).where(Firestore.FieldPath.documentId(), '==', req.body._id);

                  query.get()
                      .then(issues => {
                          if (issues.empty) {
                              console.log('No results');
                              res.json({error: 'could not update', _id: req.body._id});
                          } else {
                              issues.docs.forEach(issue => {
                                  console.log('Data', issue.data());
                                  issue.ref.update(updatedIssue).then(data => {
                                      console.log('Successful update');
                                      res.json({  result: 'successfully updated', '_id': req.body._id });
                                  }, error => {
                                      console.log(error);
                                      res.json({error: 'could not update', _id: req.body._id});
                                  });

                              })
                          }

                      }, error => {
                          console.log('Error retrieving issues');
                      })
              })
          }, error => {
              console.log('Error retrieving project');
          })
      
    })
    
    .delete(function (req, res){
      let project = req.params.project;
      
    });
    
};
