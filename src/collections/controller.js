import status from "http-status";
import Collection from "./model";

export const getCollections = (req, res, next) => {
  const { user } = req.session;
  Collection.find({ user_id: user.id }, { name: true })
    .then(collections => {
      return res.status(200).send({ collections });
    })
    .catch(err => {
      next(err);
    });
};

export const createCollection = (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(status.BAD_REQUEST).send({ message: "Name is required" });
  }

  const { user } = req.session;

  const newCollection = new Collection({ name, user_id: user.id });
  newCollection
    .save()
    .then(() => {
      return res.status(201).send({ collection: newCollection });
    })
    .catch(err => {});
};
