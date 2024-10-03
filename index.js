const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const PORT = process.env.PORT || 5000;

// MiddleWare
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kwtddbl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const userCollections = client.db("Bus-Ticket").collection('users');

        // Create user (sign-up)
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { phone: user.phone };
            const existingUser = await userCollections.findOne(query);

            if (existingUser) {
                return res.status(409).send({ message: 'User already exists. Please login.' });
            }

            const result = await userCollections.insertOne(user);
            res.status(200).send(result);
        });

        // Login
        app.post('/login', async (req, res) => {
            const { phone, password, role } = req.body;

            try {
                // Find the user by phone number
                const user = await userCollections.findOne({ phone });
                if (!user) {
                    return res.status(401).send({ message: 'User not found' });
                }

                // Check if the password matches
                if (password !== user.password) {
                    return res.status(401).send({ message: 'Invalid password' });
                }

                if (user.role !== role) {
                    return res.status(403).send({ message: 'Access denied. Role does not match.' });
                }

                const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

                res.status(200).send({ message: 'Login successful', token });
            } catch (error) {
                res.status(500).send({ message: 'Login failed', error });
            }
        });

        //getting all user from database 
        app.get('/users', async(req,res)=>{
            const user= userCollections.find();
            const result= await user.toArray();
            res.send(result);
        })

        // updated users

        // upadted or put operation
    //     app.put('/users/:id', async(req, res) =>{
    //     const id= req.params.id;
    //     const filter= { _id: new ObjectId(id)}
    //     const options= {upsert:true};
    //     const updatedUser = req.body;
    //     const users ={
    //         $set:{
    //           name: updatedUser.name,
    //             phone: updatedUser.phone,
    //             location: updatedUser.location,
    //             role: updatedUser.role,
    //             time: updatedUser.time,
               
    //         }
    //     }
    //     const result = await userCollections.updateOne(filter,users,options);
    //     res.send(result);
    // })

         // data remove or delete operation
         app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            console.log('Deleting user with ID:', id);  // Log the ID for debugging
            const query = { _id: new ObjectId(id) };
            const result = await userCollections.deleteOne(query);
            res.send(result);
          })




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('bus-ticket is running');
})

app.listen(PORT, () => {
    console.log(`bus-ticket is running on ${PORT}`);
});
