// const jwt = require("jsonwebtoken");

// const verifyJwt = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader?.startsWith("Bearer ")) return res.sendStatus(401);

//   const token = authHeader.split(" ")[1];

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) return res.sendStatus(403);
//     req.user = decoded.UserInfo.userId;
//     req.roles = decoded.UserInfo.roles;
//     next();
//   });
// };

// module.exports = verifyJwt;

const jwt = require("jsonwebtoken");

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);

    // Ensure decoded token contains expected user information
    if (!decoded.UserInfo || !decoded.UserInfo.userId || !decoded.UserInfo.roles) {
      return res.sendStatus(403);
    }

    // Extract user information from the decoded token
    req.user = decoded.UserInfo.userId;
    req.roles = decoded.UserInfo.roles;

    next();
  });
};

module.exports = verifyJwt;
