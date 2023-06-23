import { useEffect, useState } from 'react';
import {
   Button,
   Card,
   Col,
   Container, Form, FormControl, InputGroup, Row
} from 'react-bootstrap';
import Footer from '../../../modules/footer/Footer';
import Menu from '../../../modules/menu/Menu';
import { BackupRequest } from 'modules/requester';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'src/authentication/authHandler';
import infoPopup from 'modules/infoPopup';

interface BackupSettings {
   enabled: boolean;
   cronjob: string;
}


function CustomPage() {

   const [access, setAccess] = useState<boolean>(true);
   const [settings, setSettings] = useState<BackupSettings>();

   const { siteID } = useParams();

   let navigate = useNavigate();
   let auth = useAuth();

   useEffect(() => {
      if (auth.user) {
         getSettings();
      }
   }, [auth.user]);

   const getSingleBackup = () => {
      BackupRequest(auth, () => navigate('/'), siteID).get({}, 'create', (data) => {
         infoPopup.success('Sicherung erstellt', 'Backup wird heruntergeladen');
      });
   };

   const uploadSingleBackup = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const formData = new FormData(e.currentTarget);

      BackupRequest(auth, () => { }, siteID).post(formData, 'restore', (data) => {
         infoPopup.success('Sicherung wiederhergestellt', 'Backup kann nun heruntergeladen werden!');
         console.log(data);
         
      });
   };


   const getSettings = () => {
      BackupRequest(auth, () => navigate('/'), siteID).get({}, 'settings', (data) => {
         setSettings(data.res);
         setAccess(data.access);
      });
   };

   const updateSettings = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData.entries());

      BackupRequest(auth, () => navigate('/'), siteID).put({ settings: data }, 'settings', (data) => {
         infoPopup.success('Einstellungen geändert', 'Erfolgreich!');
      });

   };

   const changeSwitchSettings = (setting: EventTarget & HTMLInputElement) => {
      const data = { [setting.name]: setting.checked };

      BackupRequest(auth, () => navigate('/'), siteID).put({ settings: data }, 'settings', (data) => {
         infoPopup.success('Einstellungen geändert', 'Erfolgreich!');
      });
   };

   if (access === undefined) {
      return <div>Loading...</div>;
   }

   return (
      <>
         <Menu />
         <Container className="content dashboard">
            <Row>
               <Col>
                  <h2 className='mb-4'>Backup</h2>
               </Col>
            </Row>
            <Row>
               <Card className="settingscard">
                  <h5>Automatische Sicherung</h5>
                  <Row>
                     <Form onSubmit={updateSettings}>
                        <Col className="mb-2">
                           <InputGroup className="manage">
                              <InputGroup.Text>CronJob</InputGroup.Text>
                              <FormControl
                                 placeholder="Standard: 0 0 * * *"
                                 aria-label="CronJob für das Backup"
                                 type="text"
                                 defaultValue={settings?.cronjob}
                                 name="autoBackupTime"
                                 aria-describedby="autoBackupTimeButton"
                              />
                              <Button
                                 variant="primary"
                                 type="submit"
                                 id="autoBackupTimeButton"
                                 name="autoBackupTimeButton"
                              >
                                 Refresh
                              </Button>
                           </InputGroup>
                        </Col>
                     </Form>
                  </Row>
                  <Row className="mb-4">
                     <Col>
                        <Form.Check
                           type="switch"
                           label="Automatisches Backup Aus/An"
                           name="autoBackup"
                           defaultChecked={settings?.enabled}
                           onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              changeSwitchSettings(e.target);
                           }}
                        />
                     </Col>
                  </Row>
                  <Row>
                     <Col>
                        <h5>Sicherung erstellen</h5>
                        <InputGroup className="mb-3">
                           <Button variant="primary" id="backupSelect" onClick={getSingleBackup}>
                              Sicherung herunterladen
                           </Button>
                        </InputGroup>
                     </Col>
                     <Col>
                        <Form onSubmit={uploadSingleBackup}>
                           <h5>Sicherung wiederherstellen</h5>
                           <InputGroup className="mb-3 manage">
                              <FormControl
                                 type="file"
                                 accept=".dump"
                                 name="saveFile" />
                              <Button
                                 variant="primary"
                                 type="submit"
                              >
                                 Upload
                              </Button>
                           </InputGroup>
                        </Form>
                     </Col>
                  </Row>
                  {/* <h5>Sicherungen</h5>
                  <Row>
                     <Col>
                        <InputGroup className="mb-3 manage">
                           <InputGroup.Text id="backupSelect">Verlauf</InputGroup.Text>
                           <FormControl
                              as="select"
                              name="backupSelect"
                              aria-describedby="backupSelect"
                           >
                              <option value="0">Sicherung 1</option>
                              <option value="1">Sicherung 2</option>
                              <option value="2">Sicherung 3</option>
                           </FormControl>
                           <Button variant="danger" id="backupSelect">
                              Löschen
                           </Button>
                           <Button variant="primary" id="backupSelect">
                              Laden
                           </Button>
                        </InputGroup>
                     </Col>

                  </Row> */}
               </Card>
            </Row >
         </Container >
         <Footer />
      </>
   );
}

export default CustomPage;
