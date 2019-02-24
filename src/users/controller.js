import User from "./model";

export const createUser = data => {
  return new User(data).save();
};

export const doesUserExist = screen_name => {
  return User.findOne({ screen_name }).then(user => !!user);
};
