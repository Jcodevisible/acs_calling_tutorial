
const CommunicationIdentityClient = require("@azure/communication-administration").CommunicationIdentityClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./config.json");
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const mysql = require('mysql');

const dbconfig = {
    host: 'acsuserdb.mysql.database.azure.com',
    user: 'acscalling@acsuserdb',
    password: 'Chitahi123',
    database: 'acsusers'
};

if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `config.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);

const PORT = process.env.port || 8080;

module.exports = {
    devtool: 'inline-source-map',
    mode: 'development',
    entry: "./src/index.js",
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: "html-loader"
                    }
                ]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./public/index.html",
            filename: "./index.html"
        })
    ],
    devServer: {
        open: true,
        host: '0.0.0.0',
        disableHostCheck: true,
        port: PORT,
        before: function(app) {
            app.post('/tokens/provisionUser', jsonParser, async (req, res) => {
                try {
                    let communicationUserId = await communicationIdentityClient.createUser();
                    const tokenResponse = await communicationIdentityClient.issueToken(communicationUserId, ["voip"]);
                    console.log(tokenResponse);
                    let mysqlconn = mysql.createConnection(dbconfig);
                    mysqlconn.connect(function(err) {
                        if (err) {
                            return console.error('error: ' + err.message);
                        }  
                        console.log('Connected to the MySQL server.');
                        //var insertquery = "INSERT INTO user_token (acsmri, username, acsmri_token, acsmri_token_expires_on, displayname) VALUES ('" + tokenResponse.user.communicationUserId + "', '" + req.body.username + "', '" + tokenResponse.token + "', CAST('" + tokenResponse.expiresOn.toISOString() +"' AS DATETIME), '" + req.body.displayname +"')";
                        var insertquery = "INSERT INTO user_token (acsmri, username, acsmri_token, acsmri_token_expires_on, displayname) VALUES ('" + tokenResponse.user.communicationUserId + "', '" + req.body.username + "', '" + tokenResponse.token + "', '" + tokenResponse.expiresOn.toISOString() + "', '" + req.body.displayname +"')";
                        mysqlconn.query(insertquery, function (err, result) {
                            if (err) throw err;
                            console.log("1 record inserted");
                            mysqlconn.end(function(err) {
                                if (err) {
                                  return console.log('error:' + err.message);
                                }
                                console.log('Close the database connection.');
                            });
                        });
                    });
                    res.json(tokenResponse);
                } catch (error) {
                    console.error(error);
                }
            });
            app.post('/tokens/getExistingUser', jsonParser, async (req, res) => {
                //console.log("userid is " + req.body.userid);
                let mysqlconn = mysql.createConnection(dbconfig);
                mysqlconn.connect(function(err) {
                    if (err) {
                        return console.error('error: ' + err.message);
                    }  
                    console.log('Connected to the MySQL server.');
                    var keycolumn;
                    var keyval;
                    if(req.body.acsmri){
                        keycolumn = "acsmri";
                        keyval = req.body.acsmri;
                    } else {
                        keycolumn = "username";
                        keyval = req.body.username;
                    }
                    var selectquery = "SELECT * FROM `user_token` WHERE `" + keycolumn + "`='" + keyval + "'";
                    mysqlconn.query(selectquery, async (err, result) => {
                        if (err) throw err;
                        if (result.length == 0) {
                            mysqlconn.end(function(err) {
                                if (err) {
                                    return console.log('error:' + err.message);
                                }
                                console.log('Close the database connection.');
                            });
                            res.status(400);
                            res.send('User not found');
                        } else {
                            console.log(result);
                            var isoDateNow = new Date();
                            var expireDate = new Date(result[0].acsmri_token_expires_on);
                            var diff = (expireDate - isoDateNow)/60000;
                            console.log("minutes left to expirely " + diff);
                            if(diff < 240){
                                const tokenResponse = await communicationIdentityClient.issueToken({ communicationUserId: result[0].acsmri }, ["voip"]);
                                var updatequery = "UPDATE `user_token` SET `acsmri_token`='" + tokenResponse.token + "', `acsmri_token_expires_on`='" + tokenResponse.expiresOn.toISOString() + "' WHERE `acsmri`='" + result[0].acsmri + "'";
                                mysqlconn.query(updatequery, function (err, qresult) {
                                    if (err) throw err;
                                    console.log(qresult.affectedRows + " record(s) updated");
                                    res.json({ACS_ID: result[0].acsmri, token: tokenResponse.token, displayname: result[0].displayname});
                                    mysqlconn.end(function(err) {
                                        if (err) {
                                            return console.log('error:' + err.message);
                                        }
                                        console.log('Close the database connection.');
                                    });
                                });    
                            } else {
                                console.log("token not updated");
                                res.json({ACS_ID: result[0].acsmri, token: result[0].acsmri_token, displayname: result[0].displayname});
                                mysqlconn.end(function(err) {
                                    if (err) {
                                        return console.log('error:' + err.message);
                                    }
                                    console.log('Close the database connection.');
                                });
                            }
                            
                        }
                        
                    });
                });
            });
        }
    }
};
