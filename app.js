const express =  require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const router = require('./routes/myroutes')

const app = express();
const port = 3000;

app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));

app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.urlencoded({extended:false}));
app.use(session({secret:'secret',resave:false,saveUninitialized:false}))

app.use(router);

app.listen(port,()=>{
    console.log(`Sever running at http://localhost:${port}`)
})
