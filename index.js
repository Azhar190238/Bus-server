const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const PORT = process.env.PORT || 5000;
const nodemailer = require('nodemailer');

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

// JWT Authentication Middleware
const verifyJWT = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.user = decoded;
        next();
    });
};

// Admin Role Middleware
const verifyAdmin = async (req, res, next) => {
    const user = await client.db("Bus-Ticket").collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (user && user.role === 'admin') {
        next(); // If admin, proceed to the route
    } else {
        res.status(403).send({ message: 'Admin access required' });
    }
};

async function run() {
    try {
        const userCollections = client.db("Bus-Ticket").collection('users');
        const busCollections = client.db("Bus-Ticket").collection('buses');
        const routeCollections = client.db("Bus-Ticket").collection('routes');

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


        // for buses
        app.post('/buses', async (req, res) => {
            try {
                const bus = req.body;

                // Query to check if a bus with the same name and route already exists
                const query = { busName: bus.busName, route1: bus.route1 };
                const existingBus = await busCollections.findOne(query);

                // If the bus already exists, return a conflict status
                if (existingBus) {
                    return res.status(409).send({ message: 'Bus already exists with the same name and route.' });
                }

                // If the bus doesn't exist, insert the new bus data
                const result = await busCollections.insertOne(bus);
                return res.status(200).send(result);
            } catch (error) {
                // Handle any errors that occur during the process
                console.error('Error inserting bus data:', error);
                return res.status(500).send({ message: 'Internal Server Error' });
            }
        });
        // posting route 
        app.post('/routes', async (req, res) => {
            try {
                const bus = req.body;


                const result = await routeCollections.insertOne(bus);

                return res.status(201).send(result);
            } catch (error) {

                console.error('Error inserting bus data:', error);
                return res.status(500).send({ message: 'Internal Server Error' });
            }
        });

        // Login
        app.post('/login', async (req, res) => {
            const { phone, password, role } = req.body;

            try {
                // Find the user by phone number
                const user = await userCollections.findOne({ phone });
                if (!user) {
                    return res.status(402).send({ message: 'User not found' });
                }

                if (user.role !== role) {
                    return res.status(403).send({ message: 'Access denied. Role does not match.' });
                }

                // Check if the password matches
                if (password !== user.password) {
                    return res.status(401).send({ message: 'Invalid password' });
                }

                const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
                userToken = token;
                res.status(200).send({ message: 'Login successful', token });
            } catch (error) {
                res.status(500).send({ message: 'Login failed', error });
            }
        });





        // Check user authentication status
        app.get('/auth-status', verifyJWT, async (req, res) => {
            res.status(200).send({ isLoggedIn: true, role: req.user.role });
        });

        // get all users
        app.get('/users', async (req, res) => {
            const user = userCollections.find();
            const result = await user.toArray();
            res.send(result);
        })
        //getting routes

        app.get('/routes', async (req, res) => {
            const user = routeCollections.find();
            const result = await user.toArray();
            res.send(result);
        })

        // Bus Service
        app.get('/buses', async (req, res) => {
            const bus = busCollections.find();
            const result = await bus.toArray();
            res.send(result);
        })

        app.get('/buses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await busCollections.findOne(query);
            res.send(result);
        })

        // delete a specific user
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            console.log('Deleting user with ID:', id);
            const query = { _id: new ObjectId(id) };
            const result = await userCollections.deleteOne(query);
            res.send(result);
        })

        // delete a specific routes
        app.delete('/routes/:busId/:routeIndex', verifyJWT, verifyAdmin, async (req, res) => {
            const { busId, routeIndex } = req.params;
            console.log('Deleting route for bus with ID:', busId, 'and route index:', routeIndex);

            // Find the bus by its ID
            const query = { _id: new ObjectId(busId) };
            const bus = await routeCollections.findOne(query);

            if (!bus) {
                return res.status(404).send({ message: 'Bus not found' });
            }

            // Remove the specific route using the index
            const updatedRoutes = bus.routes.filter((route, index) => index != routeIndex);

            // Update the bus with the modified routes
            const updateQuery = { _id: new ObjectId(busId) };
            const update = {
                $set: { routes: updatedRoutes },
            };

            const result = await routeCollections.updateOne(updateQuery, update);

            if (result.modifiedCount > 0) {
                res.send({ message: 'Route deleted', deletedCount: 1 });
            } else {
                res.send({ message: 'No route deleted', deletedCount: 0 });
            }
        });



        // bus deleted 
        // delete a specific user
        app.delete('/buses/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            console.log('Deleting bus with ID:', id);
            const query = { _id: new ObjectId(id) };
            const result = await busCollections.deleteOne(query);
            res.send(result);
        })

        // bus updated 
        // upadted or put operation
        app.put('/buses/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedBus = req.body;
            const bus = {
                $set: {
                    busName: updatedBus.busName,
                    totalSeats: updatedBus.totalSeats,
                    startTime: updatedBus.startTime,
                    estimatedTime: updatedBus.estimatedTime,

                }
            }
            const result = await busCollections.updateOne(filter, bus, options);
            res.send(result);
        })

        // Updated user
        // Updated user
        // Updated user route
        app.put('/users/:userId', async (req, res) => {
            const { userId } = req.params;
            const { name, phone, location, role } = req.body;

            try {
                const filter = { _id: new ObjectId(userId) };
                const update = {
                    $set: {
                        name: name,
                        phone: phone,
                        location: location,
                        role: role
                    }
                };

                const result = await userCollections.updateOne(filter, update);

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: 'User updated successfully.' });
                } else {
                    res.send({ success: false, message: 'User not updated.' });
                }
            } catch (error) {
                console.error('Error updating user:', error);
                res.status(500).send({ success: false, message: 'Something went wrong. Please try again.' });
            }
        });




        // updated routes 
        app.put('/routes/:busId/:routeIndex', async (req, res) => {
            const { busId, routeIndex } = req.params;
            const { routeName, price } = req.body;

            try {
                const filter = { _id: new ObjectId(busId) };
                const update = {
                    $set: {
                        [`routes.${routeIndex}.routeName`]: routeName,
                        [`routes.${routeIndex}.price`]: price
                    }
                };

                const result = await routeCollections.updateOne(filter, update);

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: 'Route updated successfully.' });
                } else {
                    res.send({ success: false, message: 'Route not updated.' });
                }
            } catch (error) {
                console.error('Error updating route:', error);
                res.status(500).send({ success: false, message: 'Something went wrong. Please try again.' });
            }
        });


        // email verification
        app.post('/forgetPassword', async (req, res) => {
            const { phone, email } = req.body;

            try {
                const existingUser = await userCollections.findOne({ phone });

                if (!existingUser) {
                    return res.status(404).send({ message: 'User not found' });
                }

                //sent email
                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: '190237@ku.ac.bd',
                        pass: 'afio mvyu nrrc urkv'
                    }
                });
                const token = jwt.sign({ id: existingUser._id, role: existingUser.role }, process.env.JWT_SECRET, { expiresIn: '5m' });
                var mailOptions = {
                    from: '190237@ku.ac.bd',
                    to: email,
                    subject: 'Reset Password',
                    text: `http://localhost:5173/resetPassword/${token}`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });

                res.status(200).send({ message: 'User found', email: email });
            } catch (error) {
                res.status(500).send({ message: 'Error while searching for user', error });
            }
        });

        // reset password
        app.post('/resetPassword', async (req, res) => {
            const { token, newPassword } = req.body;

            try {
                jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                    if (err) {
                        return res.status(400).send({ message: 'Invalid or expired token' });
                    }

                    const user = await userCollections.findOne({ _id: new ObjectId(decoded.id) });

                    if (!user) {
                        return res.status(404).send({ message: 'User not found' });
                    }

                    const result = await userCollections.updateOne(
                        { _id: new ObjectId(user._id) },
                        { $set: { password: newPassword } }
                    );

                    if (result.modifiedCount === 1) {
                        return res.status(200).send({ message: 'Password updated successfully' });
                    } else {
                        return res.status(500).send({ message: 'Failed to update password' });
                    }
                });
            } catch (error) {
                res.status(500).send({ message: 'Error while resetting password', error });
            }
        });

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