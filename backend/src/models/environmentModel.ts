import mongoose from 'mongoose';

export interface IEditorSchema {
  _id: any;
  latest_version: string;
  tokens?: Tokens;
}

export interface Tokens {
  length?: number;
  SECRET_TOKEN: string;
  REFRESH_TOKEN: string;
  PERMISSON_USER: string;
  PERMISSON_ADMIN: string;
  PERMISSON_EDITOR: string;
}

const EditorSchema = new mongoose.Schema<IEditorSchema>({
  latest_version: {
    type: String
  },
  tokens: {
    SECRET_TOKEN: { type: String },
    REFRESH_TOKEN: { type: String },
    PERMISSON_USER: { type: String },
    PERMISSON_ADMIN: { type: String },
    PERMISSON_EDITOR: { type: String },
  },
});

export default mongoose.model('editor', EditorSchema);
