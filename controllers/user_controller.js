const { User, isPasswordChangeRequired, validatePassword } = require("../models/User");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const userRegister = (req, res, next) => {

    const { fullName, email, role, password } = req.body;

    User.findOne({ email: email })
        .then(user => {
            // If user found that means there is already user with that email
            if (user) return res.status(400).json({ error: `${req.body.email}, this email is already taken.` });

            const saltRound = 10;
            // hashing the original password here

            bcrypt.hash(password, saltRound, (err, hashedPassword) => {

                if (!err) {
                    // store user details in the db
                    User.create({ fullName, email, role, password: hashedPassword, passwordHistory: hashedPassword })
                        .then(user => res.status(201).json(user))
                        .catch(err => {
                            res.status(400).json({ error: err.message });
                        });
                }
                else {
                    console.log(`Error wile registering. Error message: ${err}`);
                }
            });

        })
        .catch((err => {
            res.status(500).json({ error: err.message });
        }));
};

// for user login
const userLogin = ('/login', (req, res, next) => {
    const { email, password } = req.body;

    if (email == '' || password == '') {
        return res.status(400).json({ error: 'Email or password is empty.' });
    }

    // find email from the database
    User.findOne({ email: email })
        .then(user => {
            // if (!user) return res.status(400).json({ error: 'Provided email is not registered.' });
            if (!user) return res.status(400).json({ error: 'Account has not been registered.' });


            // compare given password with hashing password of db
            bcrypt.compare(password, user.password, (err, success) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                else {
                    // password does not match 
                    if (!success) return res.status(400).json({ error: 'Account has not been registered.' });

                    // check whether account is locked or not
                    if (user.status == 'disable') return res.status(400).json({ error: 'Account has been locked.' });
                    const payload = {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        fullName: user.fullName,
                        picture: user.picture,
                    };


                    jwt.sign(
                        payload,
                        process.env.SECRET,
                        { expiresIn: '4h' },  // expires token in 4 hours
                        (err, token) => {
                            if (err) return res.status(500).json({ error: err.message });

                            console.log(`User id : ${user.id}`);
                            console.log(`User name : ${user.fullName}`);
                            console.log(`TOken: ${token}`);
                            // save the online status
                            user.save()
                                .then(success => res.json({ token: token, user: payload }))
                                .catch((err => {
                                    res.status(500).json({ error: err.message });
                                }));
                        }
                    );

                }

            });

        })
        .catch((err => res.status(500).json({ error: err.message })));

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



// replace old password by new password after validation --> Step 3
function changePasswordFromValidAccount(newPassword, User, user, res, req) {
    // replace password
    const saltRound = 10;
    bcrypt.hash(newPassword, saltRound, (err, newHashedPassword) => {
        if (!err) {
            console.log(`New hashed password: ${newHashedPassword}`);
            User.findByIdAndUpdate(req.user.id,
                {
                    $set: {
                        password: newHashedPassword,
                        passwordHistory: user.passwordHistory.concat(newHashedPassword),
                        passwordLastChanged: Date.now()
                    }
                }, { new: true })
                .then(updatedCredentials => {
                    res.status(200).json(updatedCredentials);
                })
                .catch((err => res.status(400).json({ error: err.message })));
        }
        else {
            return res.status(500).json({ error: err.message });
        }
    });
}



// check new password matches with old password or not => boolean  -- Step 2
async function passwordMatches(user, newPassword) {
    // assume new password matches with new password
    let counter = 0;
    try {
        for (let hashedoldPassword of user.passwordHistory) {
            const match = await bcrypt.compare(newPassword, hashedoldPassword);
            if (match) {
                counter++;
                console.log(`Password match counter : ${counter}`)
                return true;
            }
        }
        console.log('Password does not match');
        return false;
    }
    catch (error) {
        console.error('Error comparing passwords:', error);
        return false;
    }
}

// allow to change password and set brand new not old one, needs 2 field i.e. old password and new password
const changePassword = (req, res, next) => {

    // note: old password cannot be set as new password
    // note: store new hash passowrd in the passwordHistory array

    const { oldPassword, newPassword } = req.body;

    if (oldPassword == '' || newPassword == '') return res.status(400).json('Fields are empty.');

    if (!validatePassword(newPassword)) {
        return res.status(400).json({ error: 'Password does not follow guidelines.' });
    }

    User.findById(req.user.id)
        .then(user => {
            if (!user) return res.status(400).json({ error: 'User is not found' });

            // check new password matched with old password
            bcrypt.compare(oldPassword, user.password, async (err, success) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                if (success) {
                    // check whether old password match or not // false = new password does not match with old passwords
                    const result = await passwordMatches(user, newPassword);
                    console.log(`is new password match with old password ? Resul value : ${result}`);

                    if (!result) {
                        changePasswordFromValidAccount(newPassword, User, user, res, req);
                    }
                    else {
                        return res.status(400).json({ error: 'New password cannot be same as old password. Or something went wrong.' });
                    }
                }
                else {
                    return res.status(400).json({ error: 'Old password does not match.' });

                }
            });
        })
        .catch((err => res.status(500).json({ error: err.message })));
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
