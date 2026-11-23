// DO NOT EDIT: The whole team depends on this.
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3500;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
