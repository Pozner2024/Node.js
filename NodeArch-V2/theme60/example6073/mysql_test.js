const mysql=require("mysql");

const connectionConfig={
  host     : 'localhost',  // на каком компьютере расположена база данных
  user     : 'nodeuser',   // каким пользователем подключаемся (на учебном сервере - "root")
  password : 'nodepass',   // каким паролем подключаемся (на учебном сервере - "1234")
  database : 'learning_db' // к какой базе данных подключаемся
};

var connection = mysql.createConnection(connectionConfig);
connection.connect();
connection.query("select name, lessons_start_dat from grups where lessons_start_dat>='2019-01-01'", (error, results, fields) => {

  if (error) throw error;

  console.log('готово, '+results.length+' строк');
  results.forEach( row => {
      console.log(row.lessons_start_dat,row.name);
  } );
  
  connection.end();
});
