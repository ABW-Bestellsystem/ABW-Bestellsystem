import { Card, Container } from 'react-bootstrap';
import Footer from '../../modules/footer/Footer';
import Menu from '../../modules/menu/Menu';

const PrivacyPage = (props: any) => {
  return (
    <>
      <Menu />
      <Container className="content">
        <Card className="bg-dark text-white">
          <h1 className="mb-4">Wie werden meine Daten genutzt?</h1>

          <h4>Vor- & Nachname</h4>
          <p>
            Wir verwenden Ihren <b>Vor- und Nachname</b>, um daraus
            den Nutzernamen (vorname.nachname) zu generieren. Des Weiteren wird der Name
            bei Läuferauswahl für 2 Tage gespeichert.
            <br />
            Bei Admins wird der <b>Vor- und Nachname</b> zusätzlich für die
            Emailsignatur verwendet.
          </p>
          <h4>Passwort</h4>
          <p>
            Wir verwenden Ihr <b>Passwort</b>, um Sie beim Login zu
            authentifizieren.
          </p>
          <h4>Läuferdaten</h4>
          <p>
            Wir speichern die Anzahl, wie oft Sie Läufer waren, um Sie bei einer
            zufälligen Auswahl gegenüber anderen Nutzern weniger oder mehr zu gewichten.
          </p>
          <h4>Ausbildungsjahr</h4>
          <p>
            Das <b>Ausbildungsjahr</b> wird für die Zuordung von
            Benutzern in ihre jeweiligen Ausbildungsjahre verwendet. Jedes
            Ausbildungsjahr hat somit ihre eigene Bestellliste. <br />
            Bei Admins wird das <b>Ausbildungsjahr</b> zusätzlich für die
            Emailsignatur verwendet.
          </p>
          <h4>Bestellung</h4>
          <p>
            Wir verwenden Ihre <b>Bestellung</b>, um Sie in der Bestellliste
            eintragen zu können. Diese wird dann ohne Namensnennung Ihrerseits
            (mit Außnahme des Bestellsenders) an die Emailempfangsstelle
            geschickt! <br />
            Admins können Bestellungen individuell von Nutzern einsehen, aber nicht verändern. <br />
            Die Bestellungen werden langzeitig, anonym & nur auf dem Hostserver für
            Statistiken und bessere Bestellvorschläge verwendet.
          </p>
          <h2 className="mt-4">PDFDaten</h2>
          <h4>Email</h4>
          <p>
            Wir speichern die <b>Email</b>, um sie später als Senderemail für die
            Bestellung zu verwenden.
          </p>
          <br />
          <h4>Telefonnummer</h4>
          <p>
            Wir speichern die <b>Telefonnummer</b>, damit der Emailempfänger
            bei möglichen Fragen einen direkten Ansprechpartner hat.
          </p>
        </Card>
      </Container>
      <Footer />
    </>
  );
};

export default PrivacyPage;
