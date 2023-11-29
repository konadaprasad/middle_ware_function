const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
const connecting_server_and_db = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Sever Running");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};

connecting_server_and_db();
const response_to_map = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};
const response_to_maps = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const details = request.body;
  const { username, password } = details;
  const selectQuery = `SELECT * FROM  user  WHERE username="${username}";`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_CODE");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const AuthenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_CODE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", AuthenticateToken, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;
  const result = await db.all(getQuery);
  response.send(
    result.map((item) => {
      return {
        stateId: item.state_id,
        stateName: item.state_name,
        population: item.population,
      };
    })
  );
});

app.get("/states/:stateId/", AuthenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getBookQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const result = await db.get(getBookQuery);
  response.send(response_to_map(result));
});

app.post("/districts/", AuthenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addMovieQuery = `INSERT INTO 
    district (district_name,state_id,cases,cured,active,deaths) 
    VALUES 
   ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
  const resultItem = await db.run(addMovieQuery);
  response.send("District Successfully Added");
});
app.get(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getBookQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const result = await db.get(getBookQuery);
    response.send(response_to_maps(result));
  }
);
app.delete(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM  district WHERE  district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateQuery = `UPDATE district SET 
  district_name='${districtName}' ,state_id=${stateId}
  ,cases=${cases}, cured=${cured},active=${active},deaths=${deaths}
  WHERE district_id=${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);
app.get(
  "/states/:stateId/stats/",
  AuthenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getBookQuery = `SELECT 
  SUM(cases) as totalCases,
   SUM(cured) as totalCured,
    SUM(active) as totalActive,
     SUM(deaths) as totalDeaths FROM district WHERE state_id=${stateId};`;
    const result = await db.get(getBookQuery);
    response.send({
      totalCases: result.totalCases,
      totalCured: result.totalCured,
      totalActive: result.totalActive,
      totalDeaths: result.totalDeaths,
    });
  }
);
module.exports = app;
