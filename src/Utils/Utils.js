import {
    isCommunicationUserIdentifier,
    isPhoneNumberIdentifier,
    isMicrosoftTeamsUserIdentifier,
    isUnknownIdentifier
} from '@azure/communication-common';

export const utils = {
    getAppServiceUrl: () => {
        return window.location.origin;
    },
    provisionNewUser: async (displayName, userName) => {
        let response = await fetch('/tokens/provisionUser', {
            method: 'POST',
            body: JSON.stringify({ displayname: displayName, username: userName }),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            return response.json();
        }

        throw new Error('Invalid token response');
    },
    getExistingUser: async (userId) => {
        console.log("User ID is: " + userId);
        var jsonBody;
        if (userId.slice(0, 6) == '8:acs:'){
            jsonBody = { acsmri: userId };
        } else {
            jsonBody = { username: userId};
        }
        let response = await fetch('/tokens/getExistingUser', {
            method: 'POST',
            body: JSON.stringify(jsonBody),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            const response_data = await response.json();
            //console.log(response.json());
            //return response.json();
            return response_data;
        } 
        throw new Error('Invalid MRI or Username');
    },
    getIdentifierText: (identifier) => {
        if (isCommunicationUserIdentifier(identifier)) {
            return identifier.communicationUserId;
        } else if (isPhoneNumberIdentifier(identifier)) {
            return identifier.phoneNumber;
        } else if (isMicrosoftTeamsUserIdentifier(identifier)) {
            return identifier.microsoftTeamsUserId;
        } else if (isUnknownIdentifier(identifier) && identifier.id === '8:echo123'){
            return 'Echo Bot';
        } else {
            return 'Unknown Identifier';
        }
    },
    getRemoteParticipantObjFromIdentifier(call, identifier) {
        switch(identifier.kind) {
            case 'communicationUser': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.communicationUserId === identifier.communicationUserId
                });
            }
            case 'microsoftTeamsUser': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.microsoftTeamsUserId === identifier.microsoftTeamsUserId
                });
            }
            case 'phoneNumber': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.phoneNumber === identifier.phoneNumber
                });
            }
            case 'unknown': {
                return call.remoteParticipants.find(rm => {
                    return rm.identifier.id === identifier.id
                });
            }
        }
    }
}
