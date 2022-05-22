const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 4000;

//Use Middleware
app.use(cors());
app.use(express.json());

//Mongodb Connection

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const verify = require("jsonwebtoken/verify");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2rl34.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
   serverApi: ServerApiVersion.v1,
});

async function run() {
   try {
      await client.connect();
      const serviceCollection = client
         .db("doctors_portal")
         .collection("services");
      const appointmentCollection = client
         .db("doctors_portal")
         .collection("appointments");
      const userCollection = client.db("doctors_portal").collection("users");

      // Verify JWT
      const jwtVerify = (req, res, next) => {
         const authHeader = req.headers.authorization;
         if (!authHeader) {
            return res.status(401).send({ message: "Unauthorize access!" });
         }
         const token = authHeader.split(" ")[1];
         jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET,
            function (error, decoded) {
               if (error) {
                  return res.status(403).send({ message: "Forbidden access!" });
               }
               req.decoded = decoded;
               next();
            }
         );
      };

      // Get api to read all service name
      app.get("/service", async (req, res) => {
         const query = req.query;
         const cursor = serviceCollection.find(query).project({ name: 1 });
         const services = await cursor.toArray();
         res.send(services);
      });

      // Get api to read all available service
      app.get("/available", async (req, res) => {
         const date = req.query.date || "May 18, 2022";
         const services = await serviceCollection.find().toArray();

         const query = { date: date };
         const bookings = await appointmentCollection.find(query).toArray();

         services.forEach((service) => {
            const serviceBookings = bookings.filter(
               (b) => b.service === service.name
            );
            const bookedSlot = serviceBookings.map((b) => b.time);
            const available = service.slots.filter(
               (s) => !bookedSlot.includes(s)
            );
            service.available = available;
         });
         res.send(services);
      });

      // Get api to read appointments
      app.get("/appointment", jwtVerify, async (req, res) => {
         const query = req.query;
         const email = req.query.email;
         const page = req.query.page;
         const decodedEmail = req.decoded.email;
         if (email === decodedEmail) {
            const cursor = appointmentCollection.find(query);
            const myAppointments = await cursor.toArray();
            res.send(myAppointments);
         } else {
            res.status(403).send({ message: "Forbidden access!" });
         }
      });

      // Post api to insert one data
      app.post("/appointment", async (req, res) => {
         const data = req.body;
         const query = {
            service: data.service,
            date: data.date,
            email: data.email,
         };
         const exists = await appointmentCollection.findOne(query);
         if (exists) {
            return res.send({ success: false, appointment: exists });
         } else {
            const result = await appointmentCollection.insertOne(data);
            return res.send({ success: true, result });
         }
      });

      // Put api to add user
      app.put("/user/:email", async (req, res) => {
         const email = req.params.email;
         const data = req.body;
         const filter = { email: email };
         const options = { upsert: true };
         const updateDoc = {
            $set: data,
         };
         const result = await userCollection.updateOne(
            filter,
            updateDoc,
            options
         );
         const token = jwt.sign(
            { email: email },
            process.env.ACCESS_TOKEN_SECRET
         );
         res.send({ token, result });
      });

      // Put api to make admin
      app.put("/user/admin/:email", jwtVerify, async (req, res) => {
         const email = req.params.email;
         const filter = { email: email };
         const updateDoc = {
            $set: { role: "admin" },
         };
         const requesterEmail = req.decoded.email;
         const requesterUser = await userCollection.findOne({
            email: requesterEmail,
         });
         if (requesterUser.role === "admin") {
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send({ success: true, result });
         } else {
            res.status(403).send({ message: "forbidden" });
         }
      });

      // Get api to read all users
      app.get("/user", jwtVerify, async (req, res) => {
         const query = req.query;
         const cursor = userCollection.find(query);
         const services = await cursor.toArray();
         res.send(services);
      });

      // Get api to read check admin
      app.get("/admin/:email", jwtVerify, async (req, res) => {
         const email = req.params.email;
         const user = await userCollection.findOne({ email: email });
         const isAdmin = user.role === "admin";

         res.send({ admin: isAdmin });
      });

      // //  Patch api to make Admin
      // app.patch("/user/:email", async (req, res) => {
      //    const email = req.params.email;
      //    const data = req.body;
      //    const query = { email };
      //    const options = { upsert: true };
      //    const updateDoc = {
      //       $set: data,
      //    };
      //    const result = await appointmentCollection.updateOne(
      //       query,
      //       updateDoc,
      //       options
      //    );
      //    res.send(result);
      // });
   } finally {
   }
}
run().catch(console.dir);

app.get("/", (req, res) => {
   res.send("Welcome to Doctors Portal server!");
});

app.listen(port, () => {
   console.log(`Server is running on ${port}`);
});
