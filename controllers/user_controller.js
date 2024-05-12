const { User, isPasswordChangeRequired, validatePassword } = require("../models/User");
const jwt = require('jsonwebtoken');

const md5 = require('md5');

const userRegister = async (req, res, next) => {
    // const {fullName, email, password} = req.body;

    if (req.body.email == '' || req.body.fullName == '' || req.body.password == '') {
        return res.status(400).json({ error: 'Field is empty.' });
    }

    try {
        const user = await User.findOne({ email: req.body.email });

        console.log(`user is: ${user}`);
        if (user) {
            return res.status(400).json({ error: 'Email already exists.' });
        } else {
            const newUser = {
                fullName: req.body.fullName,
                email: req.body.email,
                role: 'user',
                // Vulnerability 1 (using weak hashing algorithm)
                password: md5(req.body.password)
            };

            try {
                const createdUser = await User.create(newUser);
                res.status(201).json(createdUser);
            }
            catch (err) {
                res.status(400).json({ error: err.message });

            }
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }

}

// using md5

const userLogin = ('/login', async (req, res, next) => {
    const { email, password } = req.body;
    if (email == '' || password == '') {
        return res.status(400).json({ error: 'Email or password is empty.' });
    }

    try {
        const user = await User.findOne({ email: email });

        if (user) {
            if (user.password == md5(password)) {

                // check whether account is locked or not
                if (user.status == 'disable') return res.status(400).json({ error: 'Account has been locked.' });
                const payload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName,
                    picture: user.picture,
                    amount: user.amount,
                };
                jwt.sign(
                    payload,
                    'sdfsafasfDFDF$%DFDFDFe545454sdf',
                    { expiresIn: '4h' },  // expires token in 4 hours
                    (err, token) => {
                        if (err) return res.status(500).json({ error: err.message });

                        console.log(`User id : ${user.id}`);
                        console.log(`User name : ${user.fullName}`);
                        console.log(`TOken: ${token}`);
                        // save the online status
                        user.save()
                            .then(success => res.json({ token: token, user: payload, email: email, password: user.password })) // Vulnerability 2 (exposing user hashed password)
                            .catch((err => {
                                res.status(500).json({ error: err.message });
                            }))
                    }

                );


            }
            else {
                return res.status(400).json({ error: 'Password does not match.' });
            }
        }
        else {
            return res.status(400).json({ error: 'Provided user credentials do not exist.' });
        }
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// lock account after 3 failed login attempts
const userAccountLock = (req, res, next) => {
    const { email } = req.body;

    if (email == '') return res.status(400).json({ error: 'Email is empty.' });

    User.findOne({ email: email })
        .then(user => {
            if (!user) return res.status(400).json({ error: 'Account has not been registered.' });

            user.status = 'disable';
            user.save()
                .then(updatedUserStatus => {
                    res.json(updatedUserStatus);
                })
                .catch((err => res.status(500).json({ error: err.message })));
        })
        .catch((err => res.status(500).json({ error: err.message })));

};

// get user profile

const getProfile = (req, res, next) => {
    console.log(`User id: ${req.user.id} , name: ${req.user.fullName}`);
    User.findById(req.user.id)
        .then(foundUser => {
            if (!foundUser) return res.status(400).json({ error: 'No user found with this token.' });

            // send only fullName, picture, email

            const registeredUser = {
                "fullName": foundUser.fullName,
                "email": foundUser.email,
                "picture": foundUser.picture,
                "amount": foundUser.amount,
            }
            res.status(200).json(registeredUser);
        })
        .catch((err => res.status(400).json({ error: err.message })));

};

// allow to update full name becasue picture will be updated by separate end point

const updateProfile = (req, res, next) => {
    if (req.body.fullName == '') return res.status(400).json('Failed to update profile.');
    User.findByIdAndUpdate(req.user.id, { $set: { fullName: req.body.fullName } }, { new: true })
        .then(updatedProduct => {
            res.status(200).json(updatedProduct);
        })
        .catch((err => res.status(400).json({ error: err.message })));
};

// verify is the password need to be changed 
const getPasswordExpiry = (req, res, next) => {
    const user = req.user;
    console.log(user);
    User.findById(req.user.id)
        .then(foundUser => {
            if (!foundUser) return res.status(400).json({ error: 'User is not found' });

            if (isPasswordChangeRequired(foundUser.passwordLastChanged)) {

                return res.status(200).json({ message: true });
            }
            else {
                return res.status(200).json({ message: false });
            }

        })
        .catch((err => res.status(500).json({ error: err.message })));
};

// allow to delete account
const deleteAccount = (req, res, next) => {
    User.findByIdAndDelete(req.user.id)
        .then(() => res.status(204).end())
        .catch((err => res.status(500).json({ error: err.message })));
}

const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (oldPassword == ''  || newPassword == '') return res.status(400).json({ error: 'Field(s) empty.' });

    // if (confirmPassword !== newPassword) return res.status(400).json({ error: 'Confirm password and password do not match.' });

    try {
        const user = await User.findById(req.user.id);

        if (md5(oldPassword) !== user.password) return res.status(400).json({ error: 'Old password does not match.' });
        console.log(`Found user : ${user}`);

        User.findByIdAndUpdate(req.user.id,
            {
                $set: {
                    password: md5(newPassword),
                    passwordHistory: user.passwordHistory.concat(md5(newPassword)),
                    passwordLastChanged: Date.now()
                }
            }, { new: true })
            .then(updatedCredentials => {
                res.status(200).json(updatedCredentials);
            })
            .catch((err => res.status(400).json({ error: err.message })));
    }

    catch (err) {
        return res.status(400).json({ error: err.message });
    }

}


module.exports = {
    userRegister,
    userLogin,
    userAccountLock,
    getProfile,
    updateProfile,
    getPasswordExpiry,
    deleteAccount,
    changePassword,

}
