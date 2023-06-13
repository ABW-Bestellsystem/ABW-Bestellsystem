import request from 'supertest';
import { app } from '../../../src';
import { IUserSchema } from '../../../src/models/userModel';

describe('Auth routes', () => {
  let user: {
    forename: string;
    surname: string;
    rank: string;
    username: string;
    password: string;
    passwordConfirm: string;
  }
  let accessToken: string

  beforeAll(async () => {
    // Create a test user
    user = {
      forename: 'Test',
      surname: 'User',
      rank: '1. IT',
      username: 'test.user',
      password: 'PSae^5#BJ8v87c!dzNpYQvSa',
      passwordConfirm: 'PSae^5#BJ8v87c!dzNpYQvSa',
    }

    await request(app)
      .post('/auth/register')
      .send({
        forename: 'Test',
        surname: 'User',
        rank: '1. IT',
        password: 'PSae^5#BJ8v87c!dzNpYQvSa',
        passwordConfirm: 'PSae^5#BJ8v87c!dzNpYQvSa',
      })
  });

  afterAll(async () => {
    // Delete the test user
  });

  describe('POST /auth/login', () => {
    it('should return a token if the credentials are correct', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: user.username, password: user.password })
        .expect(200);

      expect(res.body.res.accessToken).toBeDefined();
    });

    it('should return an error if the username is incorrect', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'password' })
        .expect(401);

      expect(res.body.error).toBe('Authentication failed');
      expect(res.body.res.accessToken).not.toBeDefined();
    });

    it('should return an error if the password is incorrect', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: user.username, password: 'wrongpassword' })
        .expect(401);

      expect(res.body.error).toBe('Authentication failed');
      expect(res.body.res.accessToken).not.toBeDefined();
    });
  });

  // describe('POST /auth/register', () => {
  //   it('should create a new user', async () => {
  //     const res = await request(app)
  //       .post('/auth/register')
  //       .send({
  //         forename: 'New',
  //         surname: 'User',
  //         rank: '1. IT',
  //         password: 'password',
  //       })
  //       .expect(201);

  //     expect(res.body.user).toBeDefined();
  //     expect(res.body.user.forename).toBe('New');
  //     expect(res.body.user.surname).toBe('User');
  //     expect(res.body.user.rank).toBe('1. IT');
  //   });

  //   it('should return an error if the username is already taken', async () => {
  //     const res = await request(app)
  //       .post('/auth/register')
  //       .send({
  //         forename: 'Test',
  //         surname: 'User',
  //         rank: '1. IT',
  //         password: 'password',
  //       })
  //       .expect(400);

  //     expect(res.body.error).toBe('Username already taken');
  //   });
  // });
});