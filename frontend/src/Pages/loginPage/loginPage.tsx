import React, { useEffect, useState } from 'react';
import {
  Button,
  Container,
  Form,
  FormControl,
  FormGroup,
  Card,
  Modal,
  Row,
  Col,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import './loginPage.css';

import infoPopup from '../../modules/infoPopup';
import { useAuth } from '../../authentication/authHandler';
import Footer from '../../modules/footer/Footer';

interface RegisterProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function getRanks() {
  let rankList = [];

  for (let i = 0; i < 3; i++) {
    rankList.push(`${i + 1}. IT`);
  }

  for (let i = 0; i < 4; i++) {
    rankList.push(`${i + 1}. EGS`);
  }

  return rankList;
}

function Register(props: RegisterProps) {
  return (
    <Modal
      show={props.show}
      onHide={props.onHide}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Form onSubmit={props.onSubmit}>
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">
            Registrieren
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col>
              <Form.Label>Vorname</Form.Label>
              <FormControl
                type="text"
                placeholder="Vorname eingeben"
                name="forename"
              />
            </Col>
            <Col>
              <Form.Label>Nachname</Form.Label>
              <FormControl
                type="text"
                placeholder="Nachname eingeben"
                name="surname"
              />
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <Form.Label>Passwort</Form.Label>
              <FormControl
                type="password"
                name="password"
                placeholder="Passwort eingeben"
              />
            </Col>
            <Col>
              <Form.Label>Passwort wiederholen</Form.Label>
              <FormControl
                type="password"
                name="passwordConfirm"
                placeholder="Passwort wiederholen"
              />
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <Form.Label>Ausbildungsjahr</Form.Label>
              <Form.Select
                defaultValue={'Ausbildungsjahr auswählen'}
                name="rank"
                aria-label="Ausbildungsjahr auswählen"
              >
                <option value={undefined} disabled>
                  Ausbildungsjahr auswählen
                </option>
                {getRanks().map((rank) => {
                  return (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  );
                })}
              </Form.Select>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" variant="primary">
            Registrieren
          </Button>
          <Button
            onClick={props.onHide}
            className="ms-auto"
            variant="secondary"
          >
            Schließen
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function LoginPage() {
  const [modalShow, setModalShow] = useState(false);

  const navigate = useNavigate();
  const auth = useAuth();

  const handleRegisterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const forename = formData.get('forename') as string;
    const surname = formData.get('surname') as string;
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('passwordConfirm') as string;
    const rank = formData.get('rank') as string;

    event.preventDefault();
    auth.register({ forename, surname, password, passwordConfirm, rank });
  };

  const handleLoginSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    event.preventDefault();
    auth.signin({ username, password }, () => navigate('/home'));
  };

  useEffect(() => {
    if (auth.accessToken.length > 0) {
      navigate('/home');
    }
  });

  useEffect(() => {
    if (auth.loggedIn === false) {
      //TODO: Prevent from showing on mount
      infoPopup.info(
        'Du wurdest ausgeloggt, weil deine Sitzung abgelaufen ist!',
        'Ausgeloggt'
      );
    }
  }, [auth.loggedIn]);

  return (
    <>
      <Register
        onSubmit={handleRegisterSubmit}
        show={modalShow}
        onHide={() => setModalShow(false)}
      />

      <Container className="loginpage d-flex align-items-center justify-content-center">
        <Card className="login">
          <Form onSubmit={(e) => handleLoginSubmit(e)}>
            <h2>ABW Bestellsystem Login</h2>
            <FormGroup controlId="formBasicText">
              <Form.Label>Benutzername</Form.Label>
              <FormControl
                type="text"
                placeholder="Benutzername eingeben"
                name="username"
              />
            </FormGroup>

            <FormGroup className="mb-4" controlId="formBasicPassword">
              <Form.Label>Passwort</Form.Label>
              <FormControl
                type="password"
                placeholder="Passwort eingeben"
                name="password"
              />
              <Form.Text className="text-muted">
                Wir werden dein Passwort niemals mit jemandem teilen.
              </Form.Text>
            </FormGroup>
            <div className="d-flex">
              <Button style={{ width: '47%' }} variant="primary" type="submit">
                Anmelden
              </Button>
              <Button
                style={{ width: '47%' }}
                variant="primary"
                className="ms-auto"
                onClick={() => setModalShow(true)}
              >
                Registrieren
              </Button>
            </div>
          </Form>
        </Card>
        <Footer />
      </Container>
    </>
  );
}

export default LoginPage;
