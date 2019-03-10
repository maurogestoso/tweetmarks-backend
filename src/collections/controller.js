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

export const createCollection = (req, res, next) => {
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
    .catch(err => {
      next(err);
    });
};

export const deleteCollection = async (req, res, next) => {
  const { collectionId } = req.params;

  try {
    const result = await Collection.findByIdAndDelete(collectionId);
    if (!result) {
      return res.status(status.NOT_FOUND).end();
    }
    return res.status(status.NO_CONTENT).end();
  } catch (err) {
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res
        .status(status.BAD_REQUEST)
        .send({ error: { message: "Invalid collection id" } });
    }
    return next(err);
  }
};
