import status from "http-status";
import Collection from "./model";
import Favorite from "../favorites/model";

export const getCollection = (req, res, next) => {
  const { user } = req.session;
  const { collectionId } = req.params;
  Collection.findOne({
    _id: collectionId,
    user_id: user.id
  })
    .then(collection => {
      if (!collection) return res.status(status.NOT_FOUND).end();
      return res.status(200).send({ collection });
    })
    .catch(err => {
      if (err.name === "CastError") {
        return res
          .status(400)
          .send({ error: { message: "Invalid collection id" } });
      }
      console.log({ err });
      next(err);
    });
};

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
      return res.status(201).send({
        collection: {
          _id: newCollection._id,
          name: newCollection.name
        }
      });
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

export const getFavoritesInCollection = async (req, res, next) => {
  const { collectionId } = req.params;
  const { user } = req.session;
  try {
    const favorites = await Favorite.find({
      user_id: user.id,
      collection_id: collectionId
    });
    return res.status(status.OK).send({ favorites });
  } catch (err) {
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res
        .status(status.BAD_REQUEST)
        .send({ error: { message: "Invalid collection id" } });
    }
    return next(err);
  }
};
