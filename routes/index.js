var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

var journalDivider = require('../journals/journalDivider');


router.get('/', function(req, res, next) {
  if (!req.user) { return res.render('home'); }
  console.log(req.user)
  next();
  res.render('index', { user: req.user });
});

/*Get journal by name */

router.get('/journal-with-name', async function(req, res, next) {
  const client = await pool.connect()

  const userId = req.user.id;
  const journalTitle = req.body.title;

  const text = 'SELECT id FROM journal_references WHERE user_id = $1 AND journal_title = $2'
  const values = [userId, journalTitle]

   //executes query
   try {

    //makes async query
    const dbResponse = await client.query(text, values);
    //prunes the database metadata the user doesn't need
    const journalId = dbResponse.rows[0];
    //returns journal_reference.id
    return res.status(200).json(journalId);
            
  } catch (err) {
    //returns generic error message
    res.status(404).json({message: 'No journal found by that title'})  
  }  
})

/*Browse existing journal entries get request */

router.get('/browse-journals', async function(req, res, next) {
  //console.log('browse journals called')
  //configures client to connect to database
  const client = await pool.connect()

  //harvests userId from session data (via cookies)
  //console.log(req.user);
  const userId = req.user.id;
  //const userId = 25;
  //configures database query / parameters
  const text = 'SELECT * FROM journal_references WHERE user_id = $1'
  const values = [userId]

  //executes query
  try {

    //makes async query
    const dbResponse = await client.query(text, values);

    
    //prunes the database metadata the user doesn't need
    const titlesAndImageUrls = dbResponse.rows.map(({user_id, ...rest}) => rest)
    
    
    return res.status(200).json(titlesAndImageUrls);
  } catch (err) {
    //returns generic error message
    res.status(404).json({message: 'No journal entries found'})  
  }  

});

/*Create new journal */

router.post('/create-journal', async function(req, res, next) {
  const client = await pool.connect()
  
  const userId = req.user.id;  
  const title = req.body.title;
  const url = req.body.url;
  

  const text = 'INSERT INTO journal_references(user_id, journal_title, cover_image) VALUES($1, $2, $3) RETURNING *'
  const values = [userId, title, url]

  try {

    const dbResponse = await client.query(text, values);
    const {journal_title, cover_image} = dbResponse.rows[0];
    return res.status(200).json({ message: `Journal saved with title: ${journal_title} and cover image link: ${cover_image}`});
        
  } catch (err) {

    //console.log(`This is the err.stack part: ${err.stack}`)
    if (err.message.includes('unique')){
      return res.status(500).json({message: 'You have already saved a journal with that title. Please choose a new title'});
    } else if (err.message.includes('long')){
      return res.status(500).json({message: 'Entry not saved. Please choose a title of 50 characters or fewer'});
    } else {
      return res.status(500).json({message: 'An unknown error prevented your journal from being saved.'})
    }    
  }  
  
  //client.release()
    
});

/*Save a journal entry */

router.post('/save-journal', async function(req, res, next) {
  //generates client to connect to database
  const client = await pool.connect()
  
  //harvests journal title and id from req.body object
  const { title, journalId } = req.body;
  
  //transforms journal entry into an array of strings each of no more than 1000 characters in length
  const processedEntry = journalDivider.journalDivider(req.body.journalEntry);
  //determines the number of sections in which the entry will be saved
  const numberOfSections = processedEntry.length;
  

  //defines database query for insertion into the journal_sections table
  const journalSectionEntry = 'INSERT INTO journal_sections(journal_reference_id, section_number) VALUES($1, $2) RETURNING *'
  //defines database query for insertion into the journal_content table
  const journalContentEntry = 'INSERT INTO journal_content(journal_section_id, content) VALUES($1, $2) RETURNING *'

  try {
    //initiates a transaction, so that if there is an error at any stage, the whole set of database changes will be rolled back
    await client.query('BEGIN')
   
    //makes entries for each section of the entry into the journal_sections table; harvests the id for each section
    let x;
    let arrayOfSectionResponses = [];
    for (x = 0; x<numberOfSections; x++){
      const journalSectionValues = [journalId, x+1]
      const dbResponse = await client.query(journalSectionEntry, journalSectionValues)
      arrayOfSectionResponses.push(dbResponse.rows[0]);
    }

    //makes entries for each section of the journal entry into the journal_content table, using the journal_section_id values from 
    //code directly above
    let y;
    let arrayOfContentResponses = [];
    for (y = 0; y<numberOfSections; y++){
      const journalContentValues = [arrayOfSectionResponses[y].id, processedEntry[y]]
      const dbResponse = await client.query(journalContentEntry, journalContentValues)
      arrayOfContentResponses.push(dbResponse.rows[0]);
    }
    //Commits all the changes, provided no errors have occurred
    await client.query('COMMIT')

    //harvests data about the result of the database queries, which can be used to check the number of sections in which it was saved
    //(ie of more use to developer than client)
    finalisedNumberOfSections = arrayOfSectionResponses.pop();
    finalisedContent = arrayOfContentResponses.pop();
    
    return res.status(200).json({ message: `Journal saved with ${finalisedNumberOfSections.section_number} sections and ${finalisedContent.id}`});
  } catch (e) {
    await client.query('ROLLBACK')
    return res.status(500).json({message: `There was some kind of error`});
    
  } finally {
    //releases client from pool
    client.release()
  }  

});

/*Delete journal entry by name */

router.delete('/journal-with-name', async function(req, res, next) {
  const client = await pool.connect()

  const userId = req.user.id;
  const journalTitle = req.query.title;
  
  //queries to locate the relevant identifiers for the different parts of the database where the content and its references are stored

  const journalReferenceQuery = 'SELECT * FROM journal_references WHERE user_id = $1 AND journal_title = $2'
  const journalReferenceValues = [userId, journalTitle]

  const journalSectionsQuery = 'SELECT * FROM journal_sections WHERE journal_reference_id = $1'

  //queries to delete the entries in journal_sections and journal_references 
  //(Note: dynamic query to delete journal_content entries generated below)

  const journalSectionsDelete = 'DELETE FROM journal_sections WHERE journal_reference_id = $1'

  const journalReferenceDelete = 'DELETE FROM journal_references WHERE id = $1'

   //executes set of queries
   try {
    //begins database transaction
    await client.query('BEGIN')

    //makes async query
    const dbReferencesResponse = await client.query(journalReferenceQuery, journalReferenceValues);
    //extracts details of journal reference
    const journalReferenceDetails = dbReferencesResponse.rows[0];
    //extracts journal_reference.id
    const journalReferenceId = [journalReferenceDetails.id];
    //makes async query to retrieve journal sections
    const dbSectionsResponse = await client.query(journalSectionsQuery, journalReferenceId);
    
    //maps the dbSectionsResponse query to create an array of indexes of journal_content entries that should be deleted
    let arrayOfIndexes = [];
    
    const journalSectionsValues = dbSectionsResponse.rows.map((section) => {      
      return arrayOfIndexes.push(section.id.toString());      
    })
    
    //if there is only a journal_reference entry but no sections / content, the below if section will be skipped and only
    //the journal_reference entry will be deleted. If there are journal_content and journal_sections entries, if section
    //will not be skipped and those entries will also be deleted
    if (arrayOfIndexes.length > 0){

    
    //generates a set of parameters for the dynamic query below, eg: $1, $2... depending on the number of content sections that 
    //need deleting

    var params = [];

    for(var i = 1; i <= arrayOfIndexes.length; i++) {

      params.push('$' + i);

    }

    //generates a dynamic query that deletes all of the different sections of content
    const journalContentDelete = 'DELETE FROM journal_content WHERE journal_section_id IN (' + params.join(',') + ')';
    
    //deletes all the different sections of content in journal_content
    await client.query(journalContentDelete, arrayOfIndexes);

    //deletes all the section entries in journal_sections
    await client.query(journalSectionsDelete, journalReferenceId);
  }
    //deletes the reference to the journal in journal_references
    await client.query(journalReferenceDelete, journalReferenceId);
    

    //commits database changes, provided there have been no errors
    await client.query('commit');

    //returns status okay with all the details for that journal entry
    return res.status(200).json({message: `Journal entry with name '${journalTitle}' has been deleted`});
    
            
  } catch (err) {
    //returns generic error message
    
    res.status(404).json({message: `It has not been possible to delete a journal entry of the name '${journalTitle}'`})  
  }  finally {
    //releases client from pool
    client.release()
  }  
})

module.exports = router;